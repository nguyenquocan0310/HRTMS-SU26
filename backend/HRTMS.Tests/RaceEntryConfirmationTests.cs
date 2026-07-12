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
/// Confirm flow RaceEntry (Module C/E): luật "Paid trước, Confirmed sau".
/// - Owner chỉ confirm được entry Pending có EntryFeeStatus = Paid (ENTRY_FEE_NOT_PAID).
/// - Admin chỉ xác nhận lệ phí / duyệt entry khi entry còn Pending (chặn resurrect Cancelled).
/// - Giải miễn phí (EntryFeeAmount = 0) auto-Paid lúc tạo entry nên confirm bình thường.
/// Dùng SQLite in-memory (relational) theo cùng pattern RaceEntryWithdrawalTests.
/// </summary>
public sealed class RaceEntryConfirmationTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerId = 10;
    private const int JockeyId = 20;

    private const int TournamentId = 1;
    private const int RoundId = 1;
    private const int RaceId = 1;
    private const int HorseId = 1;
    private const int EnrollmentId = 1;
    private const int PairingId = 1;
    private const int EntryId = 1;

    private readonly SqliteConnection _conn;

    public RaceEntryConfirmationTests()
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

    private static HorseService NewHorseService(HRTMSDbContext ctx, INotificationService? notification = null) =>
        new(ctx, new NoOpAuditLog(), notification ?? new NoOpNotification(), NewRaceEntryService(ctx));

    // =====================================================================
    // Seed: Tournament/Round/Race + Horse + Enrollment + Pairing (+ Entry)
    // =====================================================================
    private void Seed(
        decimal entryFeeAmount = 10m,
        string tournamentStatus = "Closed Registration",
        bool withEntry = true,
        string entryStatus = "Pending",
        string entryFeeStatus = "Unpaid")
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.Users.AddRange(
            NewUser(AdminId, "admin", "Admin", now),
            NewUser(OwnerId, "owner", "Owner", now),
            NewUser(JockeyId, "jockey", "Jockey", now));

        ctx.OwnerProfiles.Add(new OwnerProfile { OwnerId = OwnerId, CreatedAt = now, UpdatedAt = now });
        ctx.JockeyProfiles.Add(new JockeyProfile
        {
            JockeyId = JockeyId, LicenseCertificate = "LIC-20", ExperienceYears = 5,
            SelfDeclaredWeight = 55m, Status = "Active", CreatedAt = now, UpdatedAt = now
        });

        ctx.Tournaments.Add(new Tournament
        {
            TournamentId = TournamentId, Name = "Giải Test", StartDate = now.AddDays(-1), EndDate = now.AddDays(30),
            MaxHorses = 24, AllowedBreed = "Thoroughbred", TrackType = "Turf", RaceDistance = 1600,
            RaceCategory = "Open", MinJockeyExperienceYears = 1, PurseAmount = 1000m, EntryFeeAmount = entryFeeAmount,
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
            ScheduledTime = now.AddHours(48), PurseAmount = 500m, Status = "Upcoming",
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

        ctx.HorseTournamentEntries.Add(new HorseTournamentEntry
        {
            EnrollmentId = EnrollmentId, HorseId = HorseId, TournamentId = TournamentId, OwnerId = OwnerId,
            Status = "Enrolled", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
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

        ctx.Pairings.Add(new Pairing
        {
            PairingId = PairingId, TournamentId = TournamentId, HorseId = HorseId, JockeyId = JockeyId,
            Status = "Confirmed", CreatedAt = now, UpdatedAt = now
        });

        if (withEntry)
        {
            ctx.RaceEntries.Add(new RaceEntry
            {
                RaceEntryId = EntryId, RaceId = RaceId, PairingId = PairingId,
                Status = entryStatus, EntryFeeStatus = entryFeeStatus,
                IsWithdrawn = false, CreatedAt = now, UpdatedAt = now
            });
        }

        ctx.SaveChanges();
    }

    // =====================================================================
    // Owner ConfirmAsync — guard lệ phí
    // =====================================================================

    [Fact]
    public async Task Confirm_UnpaidFee_Blocked_EntryStaysPending()
    {
        Seed(entryFeeStatus: "Unpaid");
        using (var ctx = NewContext())
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                NewRaceEntryService(ctx).ConfirmAsync(OwnerId, EntryId));
            Assert.Equal("ENTRY_FEE_NOT_PAID", ex.Message);
        }

        using var verify = NewContext();
        var entry = await verify.RaceEntries.SingleAsync();
        Assert.Equal("Pending", entry.Status);
        Assert.Equal("Unpaid", entry.EntryFeeStatus);
    }

    [Fact]
    public async Task Confirm_PaidFee_Pending_Succeeds()
    {
        Seed(entryFeeStatus: "Paid");
        using (var ctx = NewContext())
        {
            var result = await NewRaceEntryService(ctx).ConfirmAsync(OwnerId, EntryId);
            Assert.Equal("Confirmed", result.Status);
        }

        using var verify = NewContext();
        Assert.Equal("Confirmed", (await verify.RaceEntries.SingleAsync()).Status);
    }

    [Fact]
    public async Task Confirm_NotPending_Blocked_NoDataChange()
    {
        Seed(entryStatus: "Cancelled", entryFeeStatus: "Paid");
        using (var ctx = NewContext())
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                NewRaceEntryService(ctx).ConfirmAsync(OwnerId, EntryId));
            Assert.Equal("INVALID_STATUS", ex.Message);
        }

        using var verify = NewContext();
        var entry = await verify.RaceEntries.SingleAsync();
        Assert.Equal("Cancelled", entry.Status);
        Assert.Equal("Paid", entry.EntryFeeStatus);
    }

    // =====================================================================
    // Giải miễn phí: auto-Paid lúc allocate → confirm bình thường
    // =====================================================================

    [Fact]
    public async Task FreeTournament_EntryAutoPaid_OwnerConfirms()
    {
        Seed(entryFeeAmount: 0m, tournamentStatus: "Open Registration", withEntry: false);

        int newEntryId;
        using (var ctx = NewContext())
        {
            var allocated = await NewRaceEntryService(ctx).AllocateAsync(
                AdminId, RaceId, new AllocateEntryDto { PairingId = PairingId });
            Assert.Equal("Paid", allocated.EntryFeeStatus); // EntryFeeAmount = 0 → auto-Paid
            newEntryId = allocated.RaceEntryId;
        }

        using (var ctx = NewContext())
        {
            var result = await NewRaceEntryService(ctx).ConfirmAsync(OwnerId, newEntryId);
            Assert.Equal("Confirmed", result.Status);
        }
    }

    // =====================================================================
    // Admin ConfirmEntryFeeAsync — chỉ entry Pending
    // =====================================================================

    [Fact]
    public async Task ConfirmFee_PendingUnpaid_Succeeds_RecordsAdminAndNotifies()
    {
        Seed(entryStatus: "Pending", entryFeeStatus: "Unpaid");
        var recorder = new RecordingNotification();
        using (var ctx = NewContext())
        {
            var result = await NewHorseService(ctx, recorder).ConfirmEntryFeeAsync(AdminId, EntryId);
            Assert.True(result.Success);
        }

        using var verify = NewContext();
        var entry = await verify.RaceEntries.SingleAsync();
        Assert.Equal("Paid", entry.EntryFeeStatus);
        Assert.Equal(AdminId, entry.EntryFeeConfirmedBy);
        Assert.NotNull(entry.EntryFeeConfirmedAt);
        Assert.Equal(OwnerId, Assert.Single(recorder.Recipients));
    }

    [Theory]
    [InlineData("Cancelled")]
    [InlineData("Confirmed")]
    public async Task ConfirmFee_NotPending_Blocked_FeeUnchanged(string status)
    {
        Seed(entryStatus: status, entryFeeStatus: "Unpaid");
        using (var ctx = NewContext())
        {
            var result = await NewHorseService(ctx).ConfirmEntryFeeAsync(AdminId, EntryId);
            Assert.False(result.Success);
        }

        using var verify = NewContext();
        var entry = await verify.RaceEntries.SingleAsync();
        Assert.Equal("Unpaid", entry.EntryFeeStatus);
        Assert.Null(entry.EntryFeeConfirmedBy);
    }

    // =====================================================================
    // Admin ApproveRaceEntryAsync — chặn resurrect entry Cancelled
    // =====================================================================

    [Fact]
    public async Task ApproveRaceEntry_Cancelled_Blocked_NoResurrect()
    {
        // Fee Paid để chứng minh guard chặn theo Status, không phải theo fee.
        Seed(entryStatus: "Cancelled", entryFeeStatus: "Paid");
        using (var ctx = NewContext())
        {
            var result = await NewHorseService(ctx).ApproveRaceEntryAsync(AdminId, EntryId);
            Assert.False(result.Success);
        }

        using var verify = NewContext();
        Assert.Equal("Cancelled", (await verify.RaceEntries.SingleAsync()).Status);
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

    private class NoOpNotification : INotificationService
    {
        public virtual Task SendAsync(int recipientId, string title, string message, string type = "In-app",
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

    private sealed class RecordingNotification : NoOpNotification
    {
        public List<int> Recipients { get; } = [];

        public override Task SendAsync(int recipientId, string title, string message, string type = "In-app",
            string? relatedEntityType = null, int? relatedEntityId = null)
        {
            Recipients.Add(recipientId);
            return Task.CompletedTask;
        }
    }
}
