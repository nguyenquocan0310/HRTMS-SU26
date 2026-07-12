using System.Text.Json;
using HRTMS.API.Middleware;
using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.DTOs.Notification;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HRTMS.Tests;

/// <summary>
/// Issue #7 — RowVersion optimistic concurrency (Race/RaceEntry) và
/// Issue #14 — system actor cho AutoCancelOverdueAsync + chặn login user System.
///
/// GIỚI HẠN KIỂM CHỨNG #7: SQLite không có kiểu ROWVERSION nên không tự bump
/// token sau mỗi UPDATE như SQL Server. Test đặt RowVersion ban đầu và giả lập
/// cú bump bằng raw SQL, qua đó kiểm chứng đúng cơ chế EF: UPDATE có điều kiện
/// WHERE RowVersion = giá-trị-gốc → 0 rows → DbUpdateConcurrencyException.
/// Hành vi auto-bump thật thuộc SQL Server (patch 005), ngoài phạm vi SQLite.
/// </summary>
public sealed class ConcurrencyAndSystemActorTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerId = 10;
    private const int JockeyId = 20;

    private const int TournamentId = 1;
    private const int RoundId = 1;
    private const int RaceId = 1;
    private const int HorseId = 1;
    private const int PairingId = 1;
    private const int EntryId = 1;

    private readonly SqliteConnection _conn;

    public ConcurrencyAndSystemActorTests()
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
    // Seed: Tournament/Round/Race + Horse + Pairing + Entry (+ system user)
    // =====================================================================
    private void Seed(bool withSystemUser = true, double raceInHours = 48, string entryStatus = "Pending")
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.Users.AddRange(
            NewUser(AdminId, "admin", "Admin", now),
            NewUser(OwnerId, "owner", "Owner", now),
            NewUser(JockeyId, "jockey", "Jockey", now));

        if (withSystemUser)
        {
            // Giống patch 006: PasswordHash không phải BCrypt hash hợp lệ.
            var sys = NewUser(99, "system", "System", now);
            sys.PasswordHash = "LOGIN_DISABLED";
            ctx.Users.Add(sys);
        }

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
            PreRaceWeightThresholdKg = 2m, PostRaceWeightDiffThresholdKg = 2m, Status = "Closed Registration",
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
            ScheduledTime = now.AddHours(raceInHours), PurseAmount = 500m, Status = "Upcoming",
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

        ctx.Pairings.Add(new Pairing
        {
            PairingId = PairingId, TournamentId = TournamentId, HorseId = HorseId, JockeyId = JockeyId,
            Status = "Confirmed", CreatedAt = now, UpdatedAt = now
        });

        ctx.RaceEntries.Add(new RaceEntry
        {
            RaceEntryId = EntryId, RaceId = RaceId, PairingId = PairingId,
            Status = entryStatus, EntryFeeStatus = "Unpaid",
            IsWithdrawn = false, CreatedAt = now, UpdatedAt = now
        });

        ctx.SaveChanges();
    }

    private void SetRowVersion(string table, string keyColumn, int keyValue, byte version)
    {
        using var ctx = NewContext();
        // Toàn bộ tham số là hằng số nội bộ của test (tên bảng/cột cố định) —
        // không có input ngoài nên không có rủi ro SQL injection.
#pragma warning disable EF1002
        ctx.Database.ExecuteSqlRaw(
            $"UPDATE {table} SET RowVersion = X'000000000000000{version}' WHERE {keyColumn} = {keyValue}");
#pragma warning restore EF1002
    }

    // =====================================================================
    // Issue #7 — Optimistic concurrency
    // =====================================================================

    [Fact]
    public async Task Race_ConcurrentWrite_SecondSaveThrowsConcurrencyException()
    {
        Seed();
        SetRowVersion("Races", "RaceId", RaceId, 1);

        using var ctx1 = NewContext();
        using var ctx2 = NewContext();
        var race1 = await ctx1.Races.SingleAsync(r => r.RaceId == RaceId);
        var race2 = await ctx2.Races.SingleAsync(r => r.RaceId == RaceId);

        race1.PurseAmount = 600m;
        await ctx1.SaveChangesAsync(); // request 1 thắng

        // Giả lập ROWVERSION bump mà SQL Server đã làm trong update của request 1.
        SetRowVersion("Races", "RaceId", RaceId, 2);

        race2.PurseAmount = 700m;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => ctx2.SaveChangesAsync());

        using var verify = NewContext();
        Assert.Equal(600m, (await verify.Races.SingleAsync()).PurseAmount); // request 2 không ghi đè
    }

    [Fact]
    public async Task RaceEntry_ConcurrentWrite_SecondSaveThrowsConcurrencyException()
    {
        Seed();
        SetRowVersion("RaceEntries", "RaceEntryId", EntryId, 1);

        using var ctx1 = NewContext();
        using var ctx2 = NewContext();
        var entry1 = await ctx1.RaceEntries.SingleAsync(e => e.RaceEntryId == EntryId);
        var entry2 = await ctx2.RaceEntries.SingleAsync(e => e.RaceEntryId == EntryId);

        entry1.Status = "Confirmed";
        await ctx1.SaveChangesAsync();

        SetRowVersion("RaceEntries", "RaceEntryId", EntryId, 2);

        entry2.Status = "Cancelled";
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => ctx2.SaveChangesAsync());

        using var verify = NewContext();
        Assert.Equal("Confirmed", (await verify.RaceEntries.SingleAsync()).Status);
    }

    [Fact]
    public async Task NormalUpdate_NoConflict_StillSucceeds()
    {
        Seed();
        using (var ctx = NewContext())
        {
            var race = await ctx.Races.SingleAsync(r => r.RaceId == RaceId);
            race.PurseAmount = 800m;
            await ctx.SaveChangesAsync();
        }

        using var verify = NewContext();
        Assert.Equal(800m, (await verify.Races.SingleAsync()).PurseAmount);
    }

    [Fact]
    public async Task ExceptionMiddleware_ConcurrencyException_Returns409WithStableCode()
    {
        var middleware = new ExceptionMiddleware(
            _ => throw new DbUpdateConcurrencyException("conflict"),
            NullLogger<ExceptionMiddleware>.Instance);

        var httpContext = new DefaultHttpContext();
        httpContext.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(httpContext);

        Assert.Equal(StatusCodes.Status409Conflict, httpContext.Response.StatusCode);

        httpContext.Response.Body.Position = 0;
        var body = JsonDocument.Parse(await new StreamReader(httpContext.Response.Body).ReadToEndAsync());
        Assert.Equal("CONCURRENCY_CONFLICT", body.RootElement.GetProperty("error").GetString());
        Assert.Equal("Dữ liệu vừa bị người khác thay đổi, vui lòng tải lại rồi thử lại.",
            body.RootElement.GetProperty("message").GetString());
    }

    // =====================================================================
    // Issue #14 — System actor cho AutoCancelOverdueAsync
    // =====================================================================

    [Fact]
    public async Task AutoCancel_UsesSystemUser_NotFirstAdmin()
    {
        // Admin (id 1) đứng trước system user (id 99) — nếu code còn lấy
        // "Admin Active đầu tiên" thì actor sẽ là 1, không phải 99.
        Seed(raceInHours: 1); // cutoff 24h → entry Pending đã quá hạn

        var audit = new RecordingAuditLog();
        int cancelled;
        using (var ctx = NewContext())
            cancelled = await new RaceEntryService(ctx, new NoOpNotification(), audit).AutoCancelOverdueAsync();

        Assert.Equal(1, cancelled);
        Assert.All(audit.Entries, e => Assert.Equal(99, e.ActorId));
        Assert.DoesNotContain(audit.Entries, e => e.ActorId == AdminId);

        using var verify = NewContext();
        Assert.Equal("Cancelled", (await verify.RaceEntries.SingleAsync()).Status);
    }

    [Fact]
    public async Task AutoCancel_NoSystemUser_FailsExplicitly()
    {
        Seed(withSystemUser: false, raceInHours: 1);

        using var ctx = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new RaceEntryService(ctx, new NoOpNotification(), new RecordingAuditLog()).AutoCancelOverdueAsync());
        Assert.Equal("SYSTEM_USER_NOT_FOUND", ex.Message);

        using var verify = NewContext();
        Assert.Equal("Pending", (await verify.RaceEntries.SingleAsync()).Status); // không hủy khi thiếu actor
    }

    // =====================================================================
    // Issue #14 — Chặn login user System, Admin vẫn login bình thường
    // =====================================================================

    [Fact]
    public async Task SystemUser_CannotLogin()
    {
        Seed();
        using var ctx = NewContext();
        var result = await NewAuthService(ctx).LoginAsync(
            new LoginDto { Email = "system@test.local", Password = "anything" }, ipAddress: null);

        Assert.False(result.Success);
    }

    [Fact]
    public async Task Admin_CanStillLogin()
    {
        Seed();
        using (var ctx = NewContext())
        {
            var admin = await ctx.Users.SingleAsync(u => u.UserId == AdminId);
            admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password1!");
            await ctx.SaveChangesAsync();
        }

        using var loginCtx = NewContext();
        var result = await NewAuthService(loginCtx).LoginAsync(
            new LoginDto { Email = "admin@test.local", Password = "Password1!" }, ipAddress: null);

        Assert.True(result.Success);
        Assert.Equal("Admin", result.Data!.Role);
    }

    // =====================================================================
    // Stubs & helpers
    // =====================================================================

    private static AuthService NewAuthService(HRTMSDbContext ctx)
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "unit-test-secret-key-0123456789-0123456789",
            ["JwtSettings:Issuer"] = "hrtms-tests",
            ["JwtSettings:Audience"] = "hrtms-tests",
            ["JwtSettings:ExpiryMinutes"] = "60"
        }).Build();

        // LoginAsync chỉ dùng _context, _jwtService, _auditLog — các dependency
        // còn lại không bị chạm trong login flow nên truyền null! (theo giới hạn
        // unit test hiện có, không dựng full DI).
        return new AuthService(ctx, new JwtService(config), new RecordingAuditLog(),
            null!, null!, null!, null!, null!, null!, config);
    }

    private static User NewUser(int id, string username, string role, DateTime now) => new()
    {
        UserId = id, Username = username, FullName = username,
        Email = $"{username}@test.local", NormalizedEmail = $"{username.ToUpperInvariant()}@TEST.LOCAL",
        PasswordHash = "x", Role = role, Status = "Active", CreatedAt = now, UpdatedAt = now
    };

    private sealed class RecordingAuditLog : IAuditLogService
    {
        public List<(int ActorId, string Action)> Entries { get; } = [];

        public Task LogAsync(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
        {
            Entries.Add((actorId, action));
            return Task.CompletedTask;
        }

        public void LogDeferred(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
            => Entries.Add((actorId, action));
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
