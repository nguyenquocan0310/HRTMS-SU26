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
/// Admin horse enrollment filter (Module C — GET /api/admin/horse-entries + legacy /pending alias).
/// </summary>
public sealed class HorseEnrollmentFilterTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerId = 10;

    private const int TournamentAId = 1;
    private const int TournamentBId = 2;

    private readonly SqliteConnection _conn;

    public HorseEnrollmentFilterTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        using var ctx = NewContext();
        ctx.Database.EnsureCreated();
        Seed();
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
    // Seed: 2 tournaments, 5 enrollments across Pending/Approved/Rejected
    // =====================================================================
    private void Seed()
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.Users.Add(NewUser(AdminId, "admin", "Admin", now));
        ctx.Users.Add(NewUser(OwnerId, "owner", "Owner", now));
        ctx.OwnerProfiles.Add(new OwnerProfile { OwnerId = OwnerId, CreatedAt = now, UpdatedAt = now });

        ctx.Tournaments.AddRange(
            NewTournament(TournamentAId, "Giải A", now),
            NewTournament(TournamentBId, "Giải B", now));

        for (int i = 1; i <= 5; i++)
        {
            ctx.Horses.Add(new Horse
            {
                HorseId = i, OwnerId = OwnerId, Name = $"Ngựa {i}", BirthYear = 2020, Gender = "Male",
                Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
                VaccinationRecordRef = $"VR-{i}", DopingTestResult = "Clean", LegalConsentAccepted = true,
                Status = "Declared", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                CreatedAt = now, UpdatedAt = now
            });
        }

        // TournamentA: Pending(1), Pending(2), Approved(3), Rejected(4)
        ctx.HorseTournamentEntries.AddRange(
            NewEntry(1, 1, TournamentAId, "Pending", now),
            NewEntry(2, 2, TournamentAId, "Pending", now.AddMinutes(1)),
            NewEntry(3, 3, TournamentAId, "Approved", now.AddMinutes(2)),
            NewEntry(4, 4, TournamentAId, "Rejected", now.AddMinutes(3)),
            // TournamentB: Approved(5) only
            NewEntry(5, 5, TournamentBId, "Approved", now.AddMinutes(4)));

        ctx.SaveChanges();
    }

    private static HorseTournamentEntry NewEntry(int id, int horseId, int tournamentId, string status, DateTime createdAt) => new()
    {
        EnrollmentId = id, HorseId = horseId, TournamentId = tournamentId, OwnerId = OwnerId,
        Status = "Enrolled", ScreeningStatus = "AutoEligible", AdminApprovalStatus = status,
        CreatedAt = createdAt, UpdatedAt = createdAt
    };

    private static Tournament NewTournament(int id, string name, DateTime now) => new()
    {
        TournamentId = id, Name = name, StartDate = now.AddDays(-1), EndDate = now.AddDays(30),
        MaxHorses = 24, AllowedBreed = "Thoroughbred", TrackType = "Turf", RaceDistance = 1600,
        RaceCategory = "Open", MinJockeyExperienceYears = 1, PurseAmount = 1000m, EntryFeeAmount = 10m,
        PreRaceWeightThresholdKg = 2m, PostRaceWeightDiffThresholdKg = 2m, Status = "Open Registration",
        CreatedAt = now, UpdatedAt = now
    };

    private static User NewUser(int id, string username, string role, DateTime now) => new()
    {
        UserId = id, Username = username, FullName = username,
        Email = $"{username}@test.local", NormalizedEmail = $"{username.ToUpperInvariant()}@TEST.LOCAL",
        PasswordHash = "x", Role = role, Status = "Active", CreatedAt = now, UpdatedAt = now
    };

    // =====================================================================
    // GetEnrollmentsAsync — new general route
    // =====================================================================

    [Fact]
    public async Task NoFilters_ReturnsAllStatusesAcrossAllTournaments()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(null, null, 1, 20);

        Assert.True(result.Success);
        Assert.Equal(5, result.Data!.Count);
    }

    [Fact]
    public async Task FilterStatusPending_ReturnsOnlyPending()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(null, "Pending", 1, 20);

        Assert.Equal(2, result.Data!.Count);
        Assert.All(result.Data, e => Assert.Equal("Pending", e.AdminApprovalStatus));
    }

    [Fact]
    public async Task FilterStatusApproved_ReturnsOnlyApproved()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(null, "Approved", 1, 20);

        Assert.Equal(2, result.Data!.Count);
        Assert.All(result.Data, e => Assert.Equal("Approved", e.AdminApprovalStatus));
    }

    [Fact]
    public async Task FilterStatusRejected_ReturnsOnlyRejected()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(null, "Rejected", 1, 20);

        Assert.Single(result.Data!);
        Assert.Equal("Rejected", result.Data![0].AdminApprovalStatus);
    }

    [Fact]
    public async Task FilterStatus_IsCaseInsensitiveAndTrimsWhitespace()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(null, "  pending  ", 1, 20);

        Assert.Equal(2, result.Data!.Count);
        Assert.All(result.Data, e => Assert.Equal("Pending", e.AdminApprovalStatus));
    }

    [Fact]
    public async Task FilterTournamentId_ReturnsOnlyThatTournament()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(TournamentBId, null, 1, 20);

        Assert.Single(result.Data!);
        Assert.Equal(TournamentBId, result.Data![0].TournamentId);
    }

    [Fact]
    public async Task FilterTournamentId_NonExistentTournament_ReturnsEmpty()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(999, null, 1, 20);

        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task FilterTournamentAndStatus_Combined()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(TournamentAId, "Pending", 1, 20);

        Assert.Equal(2, result.Data!.Count);
        Assert.All(result.Data, e =>
        {
            Assert.Equal(TournamentAId, e.TournamentId);
            Assert.Equal("Pending", e.AdminApprovalStatus);
        });
    }

    [Fact]
    public async Task FilterTournamentAndStatus_NoMatchingEnrollment_ReturnsEmpty()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(TournamentBId, "Rejected", 1, 20);

        Assert.Empty(result.Data!);
    }

    [Fact]
    public async Task InvalidStatus_ThrowsArgumentException()
    {
        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            NewHorseService(ctx).GetEnrollmentsAsync(null, "Approvedx", 1, 20));
        Assert.Equal("INVALID_ENROLLMENT_STATUS", ex.Message);
    }

    [Fact]
    public async Task PageLessThanOne_ClampedToFirstPage()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(null, null, 0, 20);

        Assert.Equal(5, result.Data!.Count);
    }

    [Fact]
    public async Task PageSizeLessThanOne_ClampedToDefault()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetEnrollmentsAsync(null, null, 1, 0);

        Assert.Equal(5, result.Data!.Count); // default 20, still fits all 5
    }

    [Fact]
    public async Task Pagination_NoLossOrDuplication_AcrossPages()
    {
        using var ctx1 = NewContext();
        var page1 = await NewHorseService(ctx1).GetEnrollmentsAsync(null, null, 1, 2);
        using var ctx2 = NewContext();
        var page2 = await NewHorseService(ctx2).GetEnrollmentsAsync(null, null, 2, 2);
        using var ctx3 = NewContext();
        var page3 = await NewHorseService(ctx3).GetEnrollmentsAsync(null, null, 3, 2);

        var allIds = page1.Data!.Concat(page2.Data!).Concat(page3.Data!)
            .Select(e => e.EnrollmentId).ToList();

        Assert.Equal(5, allIds.Count);
        Assert.Equal(5, allIds.Distinct().Count());
    }

    // =====================================================================
    // GetPendingEnrollmentsAsync — legacy alias must remain Pending-only
    // and equivalent to GetEnrollmentsAsync(null, "Pending", ...)
    // =====================================================================

    [Fact]
    public async Task LegacyPendingRoute_OnlyReturnsPending()
    {
        using var ctx = NewContext();
        var result = await NewHorseService(ctx).GetPendingEnrollmentsAsync(1, 20);

        Assert.Equal(2, result.Data!.Count);
        Assert.All(result.Data, e => Assert.Equal("Pending", e.AdminApprovalStatus));
    }

    [Fact]
    public async Task LegacyPendingRoute_EquivalentToNewRouteWithStatusPending()
    {
        using var ctx1 = NewContext();
        var legacy = await NewHorseService(ctx1).GetPendingEnrollmentsAsync(1, 20);
        using var ctx2 = NewContext();
        var newRoute = await NewHorseService(ctx2).GetEnrollmentsAsync(null, "Pending", 1, 20);

        var legacyIds = legacy.Data!.Select(e => e.EnrollmentId).OrderBy(x => x).ToList();
        var newIds = newRoute.Data!.Select(e => e.EnrollmentId).OrderBy(x => x).ToList();
        Assert.Equal(legacyIds, newIds);
    }

    // =====================================================================
    // Stubs
    // =====================================================================

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
