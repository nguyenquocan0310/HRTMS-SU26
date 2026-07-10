using HRTMS.Core.DTOs.Horse;
using HRTMS.Core.DTOs.Notification;
using HRTMS.Core.DTOs.RaceEntry;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRTMS.Tests;

/// <summary>
/// Withdraw &amp; Refund Integrity (Module C/E — SCH.5, HRS.6, HRS.8).
/// Dùng SQLite in-memory (relational) vì service dựa vào ExecuteUpdateAsync + transaction —
/// EF InMemory provider không hỗ trợ.
/// </summary>
public sealed class RaceEntryWithdrawalTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerId = 10;
    private const int JockeyId = 20;
    private const int SpectatorId = 30;

    private const int TournamentId = 1;
    private const int RoundId = 1;
    private const int RaceId = 1;
    private const int HorseId = 1;
    private const int EnrollmentId = 1;
    private const int PairingId = 1;
    private const int EntryId = 1;

    private const int WalletStartBalance = 100;
    private const int PointsPlaced = 40;

    private readonly SqliteConnection _conn;

    public RaceEntryWithdrawalTests()
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

    private static RaceEntryService NewRaceEntryService(HRTMSDbContext ctx) =>
        new(ctx, new NoOpNotification(), new NoOpAuditLog());

    private static HorseService NewHorseService(HRTMSDbContext ctx) =>
        new(ctx, new NoOpAuditLog(), new NoOpNotification(), NewRaceEntryService(ctx));

    // =====================================================================
    // Seed: Owner + Jockey + Spectator(Wallet) + Tournament/Round/Race +
    // Horse + Enrollment + Pairing (+ Entry + Prediction tùy tham số)
    // =====================================================================
    private void Seed(
        string tournamentStatus = "Closed Registration",
        string raceStatus = "Upcoming",
        double raceInHours = 48,
        string enrollmentApproval = "Approved",
        bool withEntry = true,
        string entryStatus = "Confirmed",
        string entryFeeStatus = "Paid",
        bool withPrediction = true)
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.Users.AddRange(
            NewUser(AdminId, "admin", "Admin", now),
            NewUser(OwnerId, "owner", "Owner", now),
            NewUser(JockeyId, "jockey", "Jockey", now),
            NewUser(SpectatorId, "spec", "Spectator", now));

        ctx.OwnerProfiles.Add(new OwnerProfile { OwnerId = OwnerId, CreatedAt = now, UpdatedAt = now });
        ctx.JockeyProfiles.Add(new JockeyProfile
        {
            JockeyId = JockeyId, LicenseCertificate = "LIC-20", ExperienceYears = 5,
            SelfDeclaredWeight = 55m, Status = "Active", CreatedAt = now, UpdatedAt = now
        });
        ctx.SpectatorProfiles.Add(new SpectatorProfile { SpectatorId = SpectatorId, CreatedAt = now });
        ctx.Wallets.Add(new Wallet { WalletId = 1, SpectatorId = SpectatorId, Balance = WalletStartBalance, UpdatedAt = now });

        ctx.Tournaments.Add(new Tournament
        {
            TournamentId = TournamentId, Name = "Giải Test", StartDate = now.AddDays(-1), EndDate = now.AddDays(30),
            MaxHorses = 24, AllowedBreed = "Thoroughbred", TrackType = "Turf", RaceDistance = 1600,
            RaceCategory = "Open", MinJockeyExperienceYears = 1, PurseAmount = 1000m, EntryFeeAmount = 10m,
            PreRaceWeightThresholdKg = 2m, PostRaceWeightDiffThresholdKg = 2m, Status = tournamentStatus,
            CreatedAt = now, UpdatedAt = now
        });

        ctx.Rounds.Add(new Round
        {
            RoundId = RoundId, TournamentId = TournamentId, Name = "Vòng loại",
            SequenceOrder = 1, ScheduledDate = now.AddDays(-1), Status = "Upcoming", UpdatedAt = now
        });

        ctx.Races.Add(new Race
        {
            RaceId = RaceId, RoundId = RoundId, RaceNumber = 1,
            ScheduledTime = now.AddHours(raceInHours), PurseAmount = 500m, Status = raceStatus,
            ConfirmationCutoffHours = 24, ProtestDeadlineMinutes = 120, CreatedAt = now, UpdatedAt = now
        });

        ctx.Horses.Add(new Horse
        {
            HorseId = HorseId, OwnerId = OwnerId, Name = "Ngựa Test", BirthYear = 2020, Gender = "Male",
            Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
            VaccinationRecordRef = "VR-1", DopingTestResult = "Clean", LegalConsentAccepted = true,
            Status = "Declared", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
            CreatedAt = now, UpdatedAt = now
        });

        ctx.TournamentParticipants.AddRange(
            new TournamentParticipant
            {
                ParticipantId = 1, TournamentId = TournamentId, UserId = JockeyId, Role = "Jockey",
                Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now
            },
            new TournamentParticipant
            {
                ParticipantId = 2, TournamentId = TournamentId, UserId = OwnerId, Role = "Owner",
                Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now
            });

        ctx.HorseTournamentEntries.Add(new HorseTournamentEntry
        {
            EnrollmentId = EnrollmentId, HorseId = HorseId, TournamentId = TournamentId, OwnerId = OwnerId,
            Status = "Enrolled", ScreeningStatus = "AutoEligible", AdminApprovalStatus = enrollmentApproval,
            CreatedAt = now, UpdatedAt = now
        });

        ctx.Pairings.Add(new Pairing
        {
            PairingId = PairingId, TournamentId = TournamentId, HorseId = HorseId, JockeyId = JockeyId,
            Status = "Confirmed", CreatedAt = now, UpdatedAt = now
        });

        if (withEntry)
        {
            ctx.RaceEntries.Add(new RaceEntry
            {
                RaceEntryId = EntryId, RaceId = RaceId, PairingId = PairingId, PostPosition = 3,
                Status = entryStatus, EntryFeeStatus = entryFeeStatus,
                IsWithdrawn = false, CreatedAt = now, UpdatedAt = now
            });

            if (withPrediction)
            {
                ctx.Predictions.Add(new Prediction
                {
                    PredictionId = 1, SpectatorId = SpectatorId, RaceId = RaceId, RaceEntryId = EntryId,
                    PredictionType = "Win", PointsPlaced = PointsPlaced, Status = "Pending", CreatedAt = now
                });
            }
        }

        ctx.SaveChanges();
    }

    // =====================================================================
    // Withdraw: hoàn điểm + sổ cái
    // =====================================================================

    [Fact]
    public async Task Withdraw_RefundsPrediction_CreditsWalletAndWritesLedgerOnce()
    {
        Seed();
        using (var ctx = NewContext())
        {
            var result = await NewRaceEntryService(ctx).WithdrawAsync(
                OwnerId, EntryId, new WithdrawEntryDto { Reason = "Owner rút lui khỏi giải" });
            Assert.False(result.AlreadyWithdrawn);
            Assert.Equal(1, result.RefundedPredictions);
        }

        using var verify = NewContext();
        var wallet = await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorId);
        Assert.Equal(WalletStartBalance + PointsPlaced, wallet.Balance);

        var ledger = await verify.VirtualPointsTransactions
            .Where(t => t.Type == "Prediction Refund").ToListAsync();
        Assert.Single(ledger);
        Assert.Equal(PointsPlaced, ledger[0].Amount);
        Assert.Equal("Prediction:1", ledger[0].ReferenceId);

        var prediction = await verify.Predictions.SingleAsync();
        Assert.Equal("Refunded", prediction.Status);

        var entry = await verify.RaceEntries.SingleAsync();
        Assert.Equal("Cancelled", entry.Status);
        Assert.Null(entry.PostPosition);
        Assert.Equal("Refund Pending", entry.EntryFeeStatus); // Paid -> Refund Pending (HRS.8)
    }

    [Fact]
    public async Task Withdraw_Twice_NoDoubleRefund()
    {
        Seed();
        using (var ctx = NewContext())
            await NewRaceEntryService(ctx).WithdrawAsync(OwnerId, EntryId, new WithdrawEntryDto());
        using (var ctx = NewContext())
        {
            var second = await NewRaceEntryService(ctx).WithdrawAsync(OwnerId, EntryId, new WithdrawEntryDto());
            Assert.True(second.AlreadyWithdrawn);
            Assert.Equal(0, second.RefundedPredictions);
        }

        using var verify = NewContext();
        Assert.Equal(WalletStartBalance + PointsPlaced,
            (await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorId)).Balance);
        Assert.Equal(1, await verify.VirtualPointsTransactions.CountAsync(t => t.Type == "Prediction Refund"));
    }

    // =====================================================================
    // Withdraw guards
    // =====================================================================

    [Fact]
    public async Task Withdraw_RaceNotUpcoming_Blocked()
    {
        Seed(raceStatus: "Official");
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewRaceEntryService(ctx).WithdrawAsync(OwnerId, EntryId, new WithdrawEntryDto()));
        Assert.Equal("RACE_NOT_UPCOMING", ex.Message);

        using var verify = NewContext();
        Assert.Equal("Confirmed", (await verify.RaceEntries.SingleAsync()).Status);
    }

    [Fact]
    public async Task Withdraw_OwnerAfterCutoff_Blocked()
    {
        Seed(raceInHours: 1); // cutoff 24h trước giờ chạy → đã qua
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewRaceEntryService(ctx).WithdrawAsync(OwnerId, EntryId, new WithdrawEntryDto()));
        Assert.Equal("WITHDRAW_AFTER_CUTOFF", ex.Message);
    }

    [Fact]
    public async Task Withdraw_SystemAfterCutoff_Allowed_WhenRaceUpcoming()
    {
        Seed(raceInHours: 1);
        using var ctx = NewContext();
        var result = await NewRaceEntryService(ctx).WithdrawAsync(
            AdminId, EntryId, new WithdrawEntryDto { Reason = "Admin điều phối khẩn cấp" }, isSystem: true);
        Assert.False(result.AlreadyWithdrawn);

        using var verify = NewContext();
        Assert.Equal("Cancelled", (await verify.RaceEntries.SingleAsync()).Status);
    }

    // =====================================================================
    // Allocate guards
    // =====================================================================

    [Fact]
    public async Task Allocate_EnrollmentRejected_Blocked()
    {
        Seed(enrollmentApproval: "Rejected", withEntry: false);
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewRaceEntryService(ctx).AllocateAsync(AdminId, RaceId, new AllocateEntryDto { PairingId = PairingId }));
        Assert.Equal("HORSE_NOT_APPROVED_IN_TOURNAMENT", ex.Message);
    }

    [Fact]
    public async Task Allocate_TournamentDraft_Blocked()
    {
        Seed(tournamentStatus: "Draft", withEntry: false);
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewRaceEntryService(ctx).AllocateAsync(AdminId, RaceId, new AllocateEntryDto { PairingId = PairingId }));
        Assert.Equal("TOURNAMENT_NOT_OPEN_FOR_SCHEDULING", ex.Message);
    }

    [Fact]
    public async Task Allocate_OpenRegistration_Succeeds()
    {
        Seed(tournamentStatus: "Open Registration", withEntry: false);
        using var ctx = NewContext();
        var result = await NewRaceEntryService(ctx).AllocateAsync(
            AdminId, RaceId, new AllocateEntryDto { PairingId = PairingId });

        Assert.Equal("Pending", result.Status);
        Assert.Equal("Unpaid", result.EntryFeeStatus); // EntryFeeAmount = 10 > 0

        using var verify = NewContext();
        Assert.Equal(1, await verify.RaceEntries.CountAsync(e => e.RaceId == RaceId && e.PairingId == PairingId));
    }

    // =====================================================================
    // Cascade: reject enrollment / reject entry / confirm fee
    // =====================================================================

    [Fact]
    public async Task RejectEnrollment_CancelsPairingAndEntry_RefundsEverything()
    {
        Seed();
        using (var ctx = NewContext())
        {
            var result = await NewHorseService(ctx).RejectEnrollmentAsync(
                AdminId, EnrollmentId, new AdminRejectHorseDto { Reason = "Hồ sơ không đạt yêu cầu của giải" });
            Assert.True(result.Success);
        }

        using var verify = NewContext();
        Assert.Equal("Rejected", (await verify.HorseTournamentEntries.SingleAsync()).AdminApprovalStatus);
        Assert.Equal("Cancelled", (await verify.Pairings.SingleAsync()).Status);

        var entry = await verify.RaceEntries.SingleAsync();
        Assert.Equal("Cancelled", entry.Status);
        Assert.Equal("Refund Pending", entry.EntryFeeStatus);
        Assert.Null(entry.PostPosition);

        Assert.Equal("Refunded", (await verify.Predictions.SingleAsync()).Status);
        Assert.Equal(WalletStartBalance + PointsPlaced,
            (await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorId)).Balance);
    }

    [Fact]
    public async Task RejectRaceEntry_PaidEntry_MovesToRefundPending()
    {
        Seed(withPrediction: false);
        using (var ctx = NewContext())
        {
            var result = await NewHorseService(ctx).RejectRaceEntryAsync(
                AdminId, EntryId, "Không đạt điều kiện thi đấu");
            Assert.True(result.Success);
        }

        using var verify = NewContext();
        var entry = await verify.RaceEntries.SingleAsync();
        Assert.Equal("Cancelled", entry.Status);
        Assert.Equal("Refund Pending", entry.EntryFeeStatus);
        Assert.Null(entry.PostPosition);
    }

    [Fact]
    public async Task ConfirmFee_OnRefundPending_Blocked()
    {
        Seed(entryFeeStatus: "Refund Pending", withPrediction: false);
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).ConfirmEntryFeeAsync(AdminId, EntryId);
        Assert.False(result.Success);

        using var verify = NewContext();
        Assert.Equal("Refund Pending", (await verify.RaceEntries.SingleAsync()).EntryFeeStatus);
    }

    // =====================================================================
    // Cancel race
    // =====================================================================

    [Fact]
    public async Task CancelRace_RefundsEverything()
    {
        Seed();
        using (var ctx = NewContext())
        {
            var result = await NewRaceEntryService(ctx).CancelRaceAsync(AdminId, RaceId, "Thời tiết xấu");
            Assert.Equal("Cancelled", result.Status);
            Assert.Equal(1, result.CancelledEntries);
            Assert.Equal(1, result.RefundedPredictions);
        }

        using var verify = NewContext();
        var race = await verify.Races.SingleAsync();
        Assert.Equal("Cancelled", race.Status);
        Assert.True(race.IsPredictionGateClosed);

        var entry = await verify.RaceEntries.SingleAsync();
        Assert.Equal("Cancelled", entry.Status);
        Assert.Equal("Refund Pending", entry.EntryFeeStatus);
        Assert.Null(entry.PostPosition);

        Assert.Equal("Refunded", (await verify.Predictions.SingleAsync()).Status);
        Assert.Equal(WalletStartBalance + PointsPlaced,
            (await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorId)).Balance);
        Assert.Equal(1, await verify.VirtualPointsTransactions.CountAsync(t => t.Type == "Prediction Refund"));
    }

    [Fact]
    public async Task CancelRace_OfficialRace_Blocked()
    {
        Seed(raceStatus: "Official");
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewRaceEntryService(ctx).CancelRaceAsync(AdminId, RaceId, null));
        Assert.Equal("RACE_ALREADY_OFFICIAL", ex.Message);
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
