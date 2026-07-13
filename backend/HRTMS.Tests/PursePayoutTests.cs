using HRTMS.Core.DTOs.Purse;
using HRTMS.Core.DTOs.Result;
using HRTMS.Core.DTOs.Notification;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRTMS.Tests;

/// <summary>
/// Module K — phân bổ Purse trong Declare Official (PRZ.2/PRZ.4, dead heat, remainder)
/// và quản lý trạng thái chi trả (PRZ.6, audit + idempotency).
/// PrizeDistributions cố định 40/25/15/12/8. SQLite lưu decimal không giữ scale nên
/// các assertion tổng dùng tolerance 0.01.
/// </summary>
public sealed class PursePayoutTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerId = 10;
    private const int JockeyId = 20;
    private const int RefereeId = 25;

    private const int TournamentId = 1;
    private const int RoundId = 1;
    private const int RaceId = 1;

    private static readonly decimal[] Percentages = [40m, 25m, 15m, 12m, 8m];

    private readonly SqliteConnection _conn;

    public PursePayoutTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        using var ctx = NewContext();
        ctx.Database.EnsureCreated();
    }

    public void Dispose() => _conn.Dispose();

    private HRTMSDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<HRTMSDbContext>().UseSqlite(_conn).Options;
        return new HRTMSDbContext(options);
    }

    // =====================================================================
    // Seed: race Unofficial sẵn sàng Declare, entries theo finishPositions
    // =====================================================================
    private void SeedRaceReadyForDeclare(decimal purse, int[] finishPositions)
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.Users.AddRange(
            NewUser(AdminId, "admin", "Admin", now),
            NewUser(OwnerId, "owner", "Owner", now),
            NewUser(JockeyId, "jockey", "Jockey", now),
            NewUser(RefereeId, "referee", "Referee", now));
        ctx.OwnerProfiles.Add(new OwnerProfile { OwnerId = OwnerId, CreatedAt = now, UpdatedAt = now });
        ctx.JockeyProfiles.Add(new JockeyProfile
        {
            JockeyId = JockeyId, LicenseCertificate = "LIC-20", ExperienceYears = 5,
            SelfDeclaredWeight = 55m, Status = "Active", CreatedAt = now, UpdatedAt = now
        });
        ctx.RefereeProfiles.Add(new RefereeProfile
        {
            RefereeId = RefereeId, CertificationLevel = "National", Status = "Active",
            CreatedAt = now, UpdatedAt = now
        });

        ctx.Tournaments.Add(new Tournament
        {
            TournamentId = TournamentId, Name = "Giải Test", StartDate = now.AddDays(-1), EndDate = now.AddDays(30),
            MaxHorses = 24, AllowedBreed = "Thoroughbred", TrackType = "Turf", RaceDistance = 1600,
            RaceCategory = "Open", MinJockeyExperienceYears = 1, PurseAmount = purse, EntryFeeAmount = 0m,
            PreRaceWeightThresholdKg = 2m, PostRaceWeightDiffThresholdKg = 2m, Status = "Closed Registration",
            CreatedAt = now, UpdatedAt = now
        });
        for (var pos = 1; pos <= 5; pos++)
            ctx.PrizeDistributions.Add(new PrizeDistribution
            {
                TournamentId = TournamentId, Position = pos, Percentage = Percentages[pos - 1],
                CreatedAt = now, UpdatedAt = now
            });

        ctx.Rounds.Add(new Round
        {
            RoundId = RoundId, TournamentId = TournamentId, Name = "Vòng loại",
            SequenceOrder = 1, ScheduledDate = now.AddDays(-1), Status = "Upcoming", UpdatedAt = now
        });
        ctx.Races.Add(new Race
        {
            RaceId = RaceId, RoundId = RoundId, RaceNumber = 1, ScheduledTime = now.AddHours(2),
            PurseAmount = purse, Status = "Unofficial", ConfirmationCutoffHours = 24,
            ProtestDeadlineMinutes = 120, CreatedAt = now, UpdatedAt = now
        });
        ctx.RaceReports.Add(new RaceReport
        {
            RaceReportId = 1, RaceId = RaceId, LeadRefereeId = RefereeId, IsLocked = false, SubmittedAt = now
        });

        ctx.TournamentParticipants.Add(new TournamentParticipant
        {
            ParticipantId = 1, TournamentId = TournamentId, UserId = JockeyId, Role = "Jockey",
            Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now
        });

        for (var i = 0; i < finishPositions.Length; i++)
        {
            var id = i + 1;
            ctx.Horses.Add(new Horse
            {
                HorseId = id, OwnerId = OwnerId, Name = $"Ngựa {id}", BirthYear = 2020, Gender = "Male",
                Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
                VaccinationRecordRef = "VR-1", DopingTestResult = "Clean", LegalConsentAccepted = true,
                Status = "Declared", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                CreatedAt = now, UpdatedAt = now
            });
            ctx.HorseTournamentEntries.Add(new HorseTournamentEntry
            {
                EnrollmentId = id, HorseId = id, TournamentId = TournamentId, OwnerId = OwnerId,
                Status = "Enrolled", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                CreatedAt = now, UpdatedAt = now
            });
            ctx.Pairings.Add(new Pairing
            {
                PairingId = id, TournamentId = TournamentId, HorseId = id, JockeyId = JockeyId,
                Status = "Confirmed", CreatedAt = now, UpdatedAt = now
            });
            ctx.RaceEntries.Add(new RaceEntry
            {
                RaceEntryId = id, RaceId = RaceId, PairingId = id, PostPosition = id,
                Status = "Confirmed", EntryFeeStatus = "Paid",
                FinishPosition = finishPositions[i], PostRaceJockeyWeight = 54m,
                IsWithdrawn = false, CreatedAt = now, UpdatedAt = now
            });
        }

        ctx.SaveChanges();
    }

    private static async Task<DeclareOfficialResultDto> DeclareAsync(HRTMSDbContext ctx)
    {
        var svc = new ResultService(ctx, new NoOpAuditLog(), new NoOpNotification());
        return await svc.DeclareOfficialAsync(RaceId, new DeclareOfficialDto { ConfirmedByAdmin = true }, AdminId);
    }

    private async Task<List<PursePayout>> PayoutsOfEntryAsync(int raceEntryId)
    {
        using var ctx = NewContext();
        return await ctx.PursePayouts.Where(p => p.RaceEntryId == raceEntryId).ToListAsync();
    }

    // =====================================================================
    // PRZ.2 — dead heat & phân bổ
    // =====================================================================

    [Fact]
    public async Task DeadHeat_AtPosition1_AveragesGroupPercentages()
    {
        // Đồng hạng 1,1 chiếm vị trí 1+2 → mỗi ngựa (40+25)/2 = 32.5% của 1000 = 325.
        SeedRaceReadyForDeclare(1000m, [1, 1, 3]);
        using (var ctx = NewContext())
            await DeclareAsync(ctx);

        using var verify = NewContext();
        Assert.Equal(325m, (await verify.RaceEntries.SingleAsync(e => e.RaceEntryId == 1)).EarningsAwarded);
        Assert.Equal(325m, (await verify.RaceEntries.SingleAsync(e => e.RaceEntryId == 2)).EarningsAwarded);
        Assert.Equal(150m, (await verify.RaceEntries.SingleAsync(e => e.RaceEntryId == 3)).EarningsAwarded);

        // Jockey đồng hạng Nhất nhận 10% phần của ngựa; hạng 3 nhận 5%.
        foreach (var entryId in new[] { 1, 2 })
        {
            var payouts = await PayoutsOfEntryAsync(entryId);
            Assert.Equal(32.5m, Assert.Single(payouts, p => p.Role == "Jockey").CalculatedAmount);
            Assert.Equal(292.5m, Assert.Single(payouts, p => p.Role == "Owner").CalculatedAmount);
        }
        var third = await PayoutsOfEntryAsync(3);
        Assert.Equal(7.5m, Assert.Single(third, p => p.Role == "Jockey").CalculatedAmount);
        Assert.Equal(142.5m, Assert.Single(third, p => p.Role == "Owner").CalculatedAmount);
    }

    [Fact]
    public async Task Tie_AcrossPrizeBoundary_SharesOnlyConfiguredPercent()
    {
        // 6 ngựa, đồng hạng 5,5 chiếm vị trí 5+6 → (8% + 0%)/2 = 4% mỗi ngựa = 40.
        SeedRaceReadyForDeclare(1000m, [1, 2, 3, 4, 5, 5]);
        DeclareOfficialResultDto result;
        using (var ctx = NewContext())
            result = await DeclareAsync(ctx);

        using var verify = NewContext();
        Assert.Equal(40m, (await verify.RaceEntries.SingleAsync(e => e.RaceEntryId == 5)).EarningsAwarded);
        Assert.Equal(40m, (await verify.RaceEntries.SingleAsync(e => e.RaceEntryId == 6)).EarningsAwarded);

        // Đã phân bổ đủ 100% → không có phần dư.
        Assert.True(result.RemainderAmount is null or 0m);
    }

    // =====================================================================
    // PRZ.4 — remainder khi ít ngựa hơn số vị trí thưởng
    // =====================================================================

    [Fact]
    public async Task FewerFinishers_RemainderStaysInPurse()
    {
        // Chỉ 2 ngựa về đích → phân bổ 40+25 = 65%; dư 35% của 1000 = 350.
        SeedRaceReadyForDeclare(1000m, [1, 2]);
        DeclareOfficialResultDto result;
        using (var ctx = NewContext())
            result = await DeclareAsync(ctx);

        Assert.Equal(350m, result.RemainderAmount);

        // GetRacePayoutsAsync derive on-the-fly: PurseAmount − TotalAllocated.
        using var ctx2 = NewContext();
        var summary = await new PursePayoutService(ctx2, new NoOpAuditLog()).GetRacePayoutsAsync(RaceId);
        Assert.Equal(1000m, summary.PurseAmount);
        Assert.True(Math.Abs(summary.TotalAllocated - 650m) < 0.01m);
        Assert.True(Math.Abs(summary.RemainderAmount - 350m) < 0.01m);
        // Bất biến: allocated + remainder = purse (theo rule rounding hiện có).
        Assert.True(Math.Abs(summary.TotalAllocated + summary.RemainderAmount - summary.PurseAmount) < 0.01m);
    }

    // =====================================================================
    // PRZ.3 — jockey share rounding
    // =====================================================================

    [Fact]
    public async Task JockeyShare_Rounding_OwnerPlusJockeyEqualsEntryPrize()
    {
        // Purse lẻ: 333.33 → hạng Nhất 40% = 133.332; jockey = round(13.3332) = 13.33;
        // owner nhận phần còn lại → tổng owner + jockey đúng bằng phần của ngựa.
        SeedRaceReadyForDeclare(333.33m, [1]);
        using (var ctx = NewContext())
            await DeclareAsync(ctx);

        var payouts = await PayoutsOfEntryAsync(1);
        var jockey = Assert.Single(payouts, p => p.Role == "Jockey").CalculatedAmount;
        var owner = Assert.Single(payouts, p => p.Role == "Owner").CalculatedAmount;

        Assert.Equal(13.33m, jockey); // Math.Round(133.332 * 0.10, 2, AwayFromZero)
        Assert.True(Math.Abs(jockey + owner - 133.332m) < 0.01m);

        using var verify = NewContext();
        var earnings = (await verify.RaceEntries.SingleAsync()).EarningsAwarded!.Value;
        Assert.True(Math.Abs(jockey + owner - earnings) < 0.01m);
    }

    // =====================================================================
    // PRZ.6 — UpdatePayoutStatus: audit + idempotency
    // =====================================================================

    private int SeedSinglePayout()
    {
        SeedRaceReadyForDeclare(1000m, [1]);
        using var ctx = NewContext();
        ctx.PursePayouts.Add(new PursePayout
        {
            PursePayoutId = 100, RaceEntryId = 1, RecipientUserId = OwnerId, Role = "Owner",
            CalculatedAmount = 400m, PayoutStatus = "Unpaid", UpdatedAt = DateTime.UtcNow
        });
        ctx.SaveChanges();
        return 100;
    }

    [Fact]
    public async Task UpdatePayoutStatus_WritesAudit()
    {
        var payoutId = SeedSinglePayout();

        using var ctx = NewContext();
        var audit = new RecordingAuditLog(ctx);
        var result = await new PursePayoutService(ctx, audit)
            .UpdatePayoutStatusAsync(payoutId, new MarkPayoutStatusDto { PayoutStatus = "Paid" }, AdminId);

        Assert.Equal("Paid", result.PayoutStatus);
        Assert.NotNull(result.PaidAt);
        Assert.Equal(AdminId, result.UpdatedByAdminId);

        var entry = Assert.Single(audit.Entries);
        Assert.Equal("Update_Payout_Status", entry.Action);
        Assert.Equal("Unpaid", entry.OldValue);
        Assert.Equal("Paid", entry.NewValue);
    }

    [Fact]
    public async Task UpdatePayoutStatus_SameStatus_IsIdempotent_NoDuplicateAudit()
    {
        var payoutId = SeedSinglePayout();

        using var ctx = NewContext();
        var audit = new RecordingAuditLog(ctx);
        var svc = new PursePayoutService(ctx, audit);

        var first = await svc.UpdatePayoutStatusAsync(payoutId, new MarkPayoutStatusDto { PayoutStatus = "Paid" }, AdminId);
        var paidAt = first.PaidAt;

        // Gọi lại cùng trạng thái → không audit thừa, không đổi PaidAt.
        var second = await svc.UpdatePayoutStatusAsync(payoutId, new MarkPayoutStatusDto { PayoutStatus = "Paid" }, AdminId);

        Assert.Single(audit.Entries);
        Assert.Equal(paidAt, second.PaidAt);

        using var verify = NewContext();
        Assert.Equal("Paid", (await verify.PursePayouts.SingleAsync(p => p.PursePayoutId == payoutId)).PayoutStatus);
    }

    // =====================================================================
    // PRZ.6 — Owner tự xem tiền thưởng của mình (self-scoped)
    // =====================================================================

    [Fact]
    public async Task GetMyEarnings_ReturnsOnlyOwnerPayouts_WithDetailAndTotals()
    {
        SeedRaceReadyForDeclare(1000m, [1, 2]);
        using (var ctx = NewContext())
            await DeclareAsync(ctx);

        using var ctx2 = NewContext();
        var result = await new PursePayoutService(ctx2, new NoOpAuditLog()).GetMyEarningsAsync(OwnerId);

        Assert.Equal(OwnerId, result.OwnerUserId);
        Assert.NotEmpty(result.Payouts);
        Assert.All(result.Payouts, p => Assert.Equal("Owner", p.Role));         // loại payout Jockey
        Assert.All(result.Payouts, p => Assert.Equal(OwnerId, p.RecipientUserId));
        Assert.Equal(result.Payouts.Count, result.PayoutCount);
        // Tổng = SUM chi tiết = Paid + Unpaid
        Assert.True(Math.Abs(result.TotalEarnings - result.Payouts.Sum(p => p.CalculatedAmount)) < 0.01m);
        Assert.True(Math.Abs(result.TotalEarnings - (result.PaidAmount + result.UnpaidAmount)) < 0.01m);
        Assert.Equal(0m, result.PaidAmount);                                    // vừa declare → chưa Paid
        // Chi tiết có bối cảnh ngựa để hiển thị "con ngựa nào thắng bao nhiêu"
        Assert.All(result.Payouts, p => Assert.False(string.IsNullOrEmpty(p.HorseName)));
    }

    [Fact]
    public async Task GetMyEarnings_NoPayouts_ReturnsZero()
    {
        SeedRaceReadyForDeclare(1000m, [1]); // KHÔNG declare → chưa sinh payout
        using var ctx = NewContext();
        var result = await new PursePayoutService(ctx, new NoOpAuditLog()).GetMyEarningsAsync(OwnerId);

        Assert.Equal(0m, result.TotalEarnings);
        Assert.Empty(result.Payouts);
        Assert.Equal(0, result.PayoutCount);
    }

    // =====================================================================
    // Stubs & helpers
    // =====================================================================

    private static User NewUser(int id, string username, string role, DateTime now) => new()
    {
        UserId = id, Username = username, FullName = username,
        Email = $"{username}@test.local", NormalizedEmail = $"{username.ToUpperInvariant()}@TEST.LOCAL",
        PasswordHash = "x", Role = role, Status = "Active", CreatedAt = now, UpdatedAt = now
    };

    private sealed record AuditEntry(string Action, string? OldValue, string? NewValue);

    /// <summary>
    /// Ghi lại audit VÀ SaveChanges — UpdatePayoutStatusAsync dựa vào LogAsync để persist
    /// payout + audit trong cùng một SaveChanges (convention của AuditLogService thật).
    /// </summary>
    private sealed class RecordingAuditLog(HRTMSDbContext ctx) : IAuditLogService
    {
        public List<AuditEntry> Entries { get; } = [];

        public async Task LogAsync(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
        {
            Entries.Add(new AuditEntry(action, oldValue, newValue));
            await ctx.SaveChangesAsync();
        }

        public void LogDeferred(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
            => Entries.Add(new AuditEntry(action, oldValue, newValue));
    }

    private sealed class NoOpAuditLog : IAuditLogService
    {
        public Task LogAsync(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
            => Task.CompletedTask;

        public void LogDeferred(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null) { }
    }

    private sealed class NoOpNotification : INotificationService
    {
        public Task SendAsync(int recipientId, string title, string message, string type = "In-app",
            string? relatedEntityType = null, int? relatedEntityId = null) => Task.CompletedTask;

        public Task SendBulkAsync(IEnumerable<int> recipientIds, string title, string message, string type = "Both",
            string? relatedEntityType = null, int? relatedEntityId = null) => Task.CompletedTask;

        public Task<IEnumerable<NotificationDto>> GetUnreadAsync(int userId) =>
            Task.FromResult(Enumerable.Empty<NotificationDto>());

        public Task<IEnumerable<NotificationDto>> GetAllAsync(int userId, int page = 1, int pageSize = 20) =>
            Task.FromResult(Enumerable.Empty<NotificationDto>());

        public Task MarkReadAsync(int notificationId, int userId) => Task.CompletedTask;

        public Task MarkAllReadAsync(int userId) => Task.CompletedTask;

        public Task<int> GetUnreadCountAsync(int userId) => Task.FromResult(0);
    }
}
