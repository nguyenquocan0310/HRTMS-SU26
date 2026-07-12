using HRTMS.Core.DTOs.Notification;
using HRTMS.Core.DTOs.Tournament;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRTMS.Tests;

/// <summary>
/// Module B — field-lock theo lifecycle (TRN.9), guard cấu trúc Round/Race (TRN.8),
/// advancement rule MVP và notification khi mở/đóng đăng ký.
/// SQLite in-memory (relational) — cùng pattern các test khác.
/// </summary>
public sealed class TournamentLifecycleTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerId = 10;
    private const int JockeyId = 20;

    private const int TournamentId = 1;
    private const int RoundId = 1;
    private const int RaceId = 1;

    private readonly SqliteConnection _conn;
    private readonly RecordingAuditLog _audit = new();
    private readonly RecordingNotification _notification = new();

    public TournamentLifecycleTests()
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

    private TournamentSevice NewService(HRTMSDbContext ctx) =>
        new(ctx, _audit, new RaceEntryService(ctx, _notification, _audit), _notification);

    // =====================================================================
    // Seed
    // =====================================================================
    private void Seed(
        string tournamentStatus = "Open Registration",
        bool withRound = true,
        bool withRace = true,
        int activeEntries = 0,
        bool withParticipants = false,
        bool withConfirmedPairing = false,
        bool withPrizeDistributions = false)
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
            RaceCategory = "Open", MinJockeyExperienceYears = 1, PurseAmount = 1000m, EntryFeeAmount = 10m,
            PreRaceWeightThresholdKg = 2m, PostRaceWeightDiffThresholdKg = 2m, Status = tournamentStatus,
            CreatedAt = now, UpdatedAt = now
        });

        if (withPrizeDistributions)
        {
            for (var pos = 1; pos <= 5; pos++)
                ctx.PrizeDistributions.Add(new PrizeDistribution
                {
                    TournamentId = TournamentId, Position = pos, Percentage = 20m,
                    CreatedAt = now, UpdatedAt = now
                });
        }

        if (withRound)
            ctx.Rounds.Add(new Round
            {
                RoundId = RoundId, TournamentId = TournamentId, Name = "Vòng loại",
                SequenceOrder = 1, ScheduledDate = now.AddDays(-1), Status = "Upcoming", UpdatedAt = now
            });

        if (withRace)
            ctx.Races.Add(new Race
            {
                RaceId = RaceId, RoundId = RoundId, RaceNumber = 1,
                ScheduledTime = now.AddHours(48), PurseAmount = 500m, Status = "Upcoming",
                ConfirmationCutoffHours = 24, ProtestDeadlineMinutes = 120, CreatedAt = now, UpdatedAt = now
            });

        if (withParticipants)
            ctx.TournamentParticipants.AddRange(
                new TournamentParticipant
                {
                    ParticipantId = 1, TournamentId = TournamentId, UserId = OwnerId, Role = "Owner",
                    Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now
                },
                new TournamentParticipant
                {
                    ParticipantId = 2, TournamentId = TournamentId, UserId = JockeyId, Role = "Jockey",
                    Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now
                });

        if (withConfirmedPairing || activeEntries > 0)
        {
            // Cần participant Jockey cho composite FK của Pairing.
            if (!withParticipants)
                ctx.TournamentParticipants.Add(new TournamentParticipant
                {
                    ParticipantId = 2, TournamentId = TournamentId, UserId = JockeyId, Role = "Jockey",
                    Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now
                });

            for (var i = 1; i <= Math.Max(1, activeEntries); i++)
            {
                ctx.Horses.Add(new Horse
                {
                    HorseId = i, OwnerId = OwnerId, Name = $"Ngựa {i}", BirthYear = 2020, Gender = "Male",
                    Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
                    VaccinationRecordRef = "VR-1", DopingTestResult = "Clean", LegalConsentAccepted = true,
                    Status = "Declared", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                    CreatedAt = now, UpdatedAt = now
                });
                ctx.HorseTournamentEntries.Add(new HorseTournamentEntry
                {
                    EnrollmentId = i, HorseId = i, TournamentId = TournamentId, OwnerId = OwnerId,
                    Status = "Enrolled", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                    CreatedAt = now, UpdatedAt = now
                });
                ctx.Pairings.Add(new Pairing
                {
                    PairingId = i, TournamentId = TournamentId, HorseId = i, JockeyId = JockeyId,
                    Status = "Confirmed", CreatedAt = now, UpdatedAt = now
                });
            }

            for (var i = 1; i <= activeEntries; i++)
                ctx.RaceEntries.Add(new RaceEntry
                {
                    RaceEntryId = i, RaceId = RaceId, PairingId = i, PostPosition = i,
                    Status = "Confirmed", EntryFeeStatus = "Paid",
                    IsWithdrawn = false, CreatedAt = now, UpdatedAt = now
                });
        }

        ctx.SaveChanges();
    }

    // =====================================================================
    // Field-lock (TRN.9)
    // =====================================================================

    [Fact]
    public async Task UpdateAllowedBreed_OpenRegistration_Blocked()
    {
        Seed(tournamentStatus: "Open Registration");
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewService(ctx).UpdateTournamentAsync(TournamentId,
                new UpdateTournamentDto { AllowedBreed = "Arabian" }, AdminId));
        Assert.Contains("FIELD_LOCKED_OPEN_REGISTRATION", ex.Message);
        Assert.Contains("AllowedBreed", ex.Message);
    }

    [Fact]
    public async Task UpdateAllowedBreed_Draft_Allowed()
    {
        Seed(tournamentStatus: "Draft", withRound: false, withRace: false);
        using var ctx = NewContext();
        var result = await NewService(ctx).UpdateTournamentAsync(TournamentId,
            new UpdateTournamentDto { AllowedBreed = "Arabian" }, AdminId);
        Assert.Equal("Arabian", result.AllowedBreed);
    }

    [Fact]
    public async Task DecreaseMaxHorses_BelowActiveEntries_Blocked()
    {
        Seed(activeEntries: 2);
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewService(ctx).UpdateTournamentAsync(TournamentId,
                new UpdateTournamentDto { MaxHorses = 1 }, AdminId));
        Assert.Contains("2 ngựa hợp lệ", ex.Message);
    }

    [Fact]
    public async Task IncreaseMaxHorses_Succeeds()
    {
        Seed(activeEntries: 2);
        using var ctx = NewContext();
        var result = await NewService(ctx).UpdateTournamentAsync(TournamentId,
            new UpdateTournamentDto { MaxHorses = 30 }, AdminId);
        Assert.Equal(30, result.MaxHorses);
    }

    [Fact]
    public async Task UpdateStartDate_WithRounds_Blocked()
    {
        Seed(tournamentStatus: "Draft", withRound: true, withRace: false);
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewService(ctx).UpdateTournamentAsync(TournamentId,
                new UpdateTournamentDto { StartDate = DateTime.UtcNow.AddDays(2) }, AdminId));
        Assert.Contains("vòng đấu", ex.Message);
    }

    [Fact]
    public async Task UpdateTournament_WritesAuditWithChangedFields()
    {
        Seed(tournamentStatus: "Draft", withRound: false, withRace: false);
        using var ctx = NewContext();
        await NewService(ctx).UpdateTournamentAsync(TournamentId,
            new UpdateTournamentDto { Name = "Giải Mới" }, AdminId);

        var entry = Assert.Single(_audit.Entries, e => e.Action == "Update_Tournament");
        Assert.Equal(TournamentId.ToString(), entry.EntityId);
        Assert.Contains("Name", entry.NewValue);
        Assert.Contains("Giải Mới", entry.NewValue);
    }

    // =====================================================================
    // Round/Race lifecycle guard (TRN.8)
    // =====================================================================

    [Fact]
    public async Task CreateRace_CancelledTournament_Blocked()
    {
        Seed(tournamentStatus: "Cancelled");
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewService(ctx).CreateRaceAsync(RoundId, new CreateRaceDto
            {
                RaceNumber = 2, ScheduledTime = DateTime.UtcNow.AddDays(2), PurseAmount = 100m
            }, AdminId));
        Assert.Contains("đã bị hủy", ex.Message);
    }

    [Fact]
    public async Task UpdateRace_CancelledTournament_Blocked()
    {
        Seed(tournamentStatus: "Cancelled");
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewService(ctx).UpdateRaceAsync(RaceId, new UpdateRaceDto
            {
                ScheduledTime = DateTime.UtcNow.AddDays(2), PurseAmount = 100m
            }, AdminId));
        Assert.Contains("đã bị hủy", ex.Message);
    }

    [Fact]
    public async Task CreateRound_CompletedTournament_Blocked()
    {
        Seed(tournamentStatus: "Completed", withRound: false, withRace: false);
        using var ctx = NewContext();
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewService(ctx).CreateRoundAsync(TournamentId, new CreateRoundDto
            {
                Name = "Vòng mới", SequenceOrder = 1, ScheduledDate = DateTime.UtcNow.AddDays(2)
            }, AdminId));
    }

    // =====================================================================
    // Advancement rule MVP + StartDate quá khứ
    // =====================================================================

    [Fact]
    public async Task CreateTournament_EarningsBased_Blocked()
    {
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            NewService(ctx).CreateTournamentAsync(NewCreateDto(advancementRule: "EarningsBased"), AdminId));
        Assert.Contains("chưa hỗ trợ ở phiên bản này", ex.Message);
    }

    [Fact]
    public async Task CreateTournament_PastStartDate_Blocked()
    {
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            NewService(ctx).CreateTournamentAsync(NewCreateDto(startDate: DateTime.UtcNow.AddDays(-3)), AdminId));
        Assert.Contains("quá khứ", ex.Message);
    }

    [Fact]
    public async Task UpdateTournament_HybridRule_Blocked()
    {
        Seed(tournamentStatus: "Draft", withRound: false, withRace: false);
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            NewService(ctx).UpdateTournamentAsync(TournamentId,
                new UpdateTournamentDto { AdvancementRule = "Hybrid" }, AdminId));
        Assert.Contains("chưa hỗ trợ ở phiên bản này", ex.Message);
    }

    // =====================================================================
    // Notification khi mở/đóng đăng ký
    // =====================================================================

    [Fact]
    public async Task ChangeStatus_ClosedRegistration_NotifiesParticipants()
    {
        Seed(tournamentStatus: "Open Registration",
             withParticipants: true, withConfirmedPairing: true, withPrizeDistributions: true);
        using var ctx = NewContext();
        await NewService(ctx).ChangeStatusAsync(TournamentId, "Closed Registration", AdminId);

        var bulk = Assert.Single(_notification.BulkSends);
        Assert.Contains(OwnerId, bulk.RecipientIds);
        Assert.Contains(JockeyId, bulk.RecipientIds);
        Assert.Contains("đóng đăng ký", bulk.Title);
    }

    [Fact]
    public async Task ChangeStatus_OpenRegistration_NoParticipants_NoErrorNoNotification()
    {
        Seed(tournamentStatus: "Draft", withRound: false, withRace: false, withPrizeDistributions: true);
        using var ctx = NewContext();
        var result = await NewService(ctx).ChangeStatusAsync(TournamentId, "Open Registration", AdminId);

        Assert.Equal("Open Registration", result.Status);
        Assert.Empty(_notification.BulkSends);
    }

    // =====================================================================
    // Stubs & helpers
    // =====================================================================

    private static CreateTournamentDto NewCreateDto(
        string? advancementRule = null, DateTime? startDate = null) => new()
    {
        Name = "Giải Mới",
        StartDate = startDate ?? DateTime.UtcNow.AddDays(1),
        EndDate = (startDate ?? DateTime.UtcNow.AddDays(1)).AddDays(10),
        MaxHorses = 24,
        AllowedBreed = "Thoroughbred",
        TrackType = "Turf",
        RaceDistance = 1600,
        RaceCategory = "Open",
        MinJockeyExperienceYears = 1,
        PurseAmount = 1000m,
        EntryFeeAmount = 0m,
        PreRaceWeightThresholdKg = 2m,
        PostRaceWeightDiffThresholdKg = 1m,
        AdvancementRule = advancementRule
    };

    private static User NewUser(int id, string username, string role, DateTime now) => new()
    {
        UserId = id, Username = username, FullName = username,
        Email = $"{username}@test.local", NormalizedEmail = $"{username.ToUpperInvariant()}@TEST.LOCAL",
        PasswordHash = "x", Role = role, Status = "Active", CreatedAt = now, UpdatedAt = now
    };

    private sealed record AuditEntry(string Action, string EntityId, string? OldValue, string? NewValue);

    private sealed class RecordingAuditLog : IAuditLogService
    {
        public List<AuditEntry> Entries { get; } = [];

        public Task LogAsync(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
        {
            Entries.Add(new AuditEntry(action, entityId, oldValue, newValue));
            return Task.CompletedTask;
        }

        public void LogDeferred(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
            => Entries.Add(new AuditEntry(action, entityId, oldValue, newValue));
    }

    private sealed record BulkSend(List<int> RecipientIds, string Title, string Message);

    private sealed class RecordingNotification : INotificationService
    {
        public List<BulkSend> BulkSends { get; } = [];

        public Task SendAsync(int recipientId, string title, string message, string type = "In-app",
            string? relatedEntityType = null, int? relatedEntityId = null) => Task.CompletedTask;

        public Task SendBulkAsync(IEnumerable<int> recipientIds, string title, string message, string type = "Both",
            string? relatedEntityType = null, int? relatedEntityId = null)
        {
            BulkSends.Add(new BulkSend(recipientIds.ToList(), title, message));
            return Task.CompletedTask;
        }

        public Task<IEnumerable<NotificationDto>> GetUnreadAsync(int userId) =>
            Task.FromResult(Enumerable.Empty<NotificationDto>());

        public Task<IEnumerable<NotificationDto>> GetAllAsync(int userId, int page = 1, int pageSize = 20) =>
            Task.FromResult(Enumerable.Empty<NotificationDto>());

        public Task MarkReadAsync(int notificationId, int userId) => Task.CompletedTask;

        public Task MarkAllReadAsync(int userId) => Task.CompletedTask;

        public Task<int> GetUnreadCountAsync(int userId) => Task.FromResult(0);
    }
}
