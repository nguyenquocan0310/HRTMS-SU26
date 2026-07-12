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
/// Khóa hành vi tham gia nhiều giải (Module B roster + C horse + E scheduling).
/// Quyết định thiết kế MVP (SRS TRN.11 chỉ yêu cầu unique-trong-giải, KHÔNG bắt
/// Jockey single-tournament):
///   • Jockey/Owner/Doctor/Referee: đăng ký nhiều giải song song — CHO PHÉP;
///     chỉ chặn trùng roster trong CÙNG 1 giải (UQ_TP_TourUser + app check).
///   • Horse: chặn tham gia >1 giải chưa kết thúc (vật lý, SRS Module C).
///   • Ràng buộc vật lý của Jockey = trùng giờ ở cấp RACE (SCH.8 DOUBLE_BOOKED),
///     không phải ở cấp roster.
/// Nếu về sau nhóm chốt Jockey single-tournament, guard thêm CHỈ cho Role=Jockey
/// trong RegisterAsync và các test "multi-tournament" của Jockey sẽ được đảo lại.
/// SQLite in-memory theo cùng pattern các test hiện có.
/// </summary>
public sealed class RosterMultiTournamentTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerId = 10;
    private const int JockeyId = 20;
    private const int DoctorId = 30;
    private const int RefereeId = 40;
    private const int JockeyId2 = 21;

    private const int T1 = 1; // Open Registration
    private const int T2 = 2; // Open Registration
    private const int TDone = 3; // Completed

    private readonly SqliteConnection _conn;

    public RosterMultiTournamentTests()
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

    private static TournamentParticipantService NewRosterService(HRTMSDbContext ctx) =>
        new(ctx, new NoOpAuditLog(), new NoOpNotification());

    private static RaceEntryService NewRaceEntryService(HRTMSDbContext ctx) =>
        new(ctx, new NoOpNotification(), new NoOpAuditLog());

    private static HorseService NewHorseService(HRTMSDbContext ctx) =>
        new(ctx, new NoOpAuditLog(), new NoOpNotification(), NewRaceEntryService(ctx));

    // =====================================================================
    // Seed cơ bản: 3 giải + user đủ điều kiện screening AutoEligible
    // =====================================================================
    private void SeedBase()
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.Users.AddRange(
            NewUser(AdminId, "admin", "Admin", now, withIdentity: false),
            NewUser(OwnerId, "owner", "Owner", now, withIdentity: true),
            NewUser(JockeyId, "jockey", "Jockey", now, withIdentity: true),
            NewUser(JockeyId2, "jockey2", "Jockey", now, withIdentity: true),
            NewUser(DoctorId, "doctor", "Doctor", now, withIdentity: true),
            NewUser(RefereeId, "referee", "Referee", now, withIdentity: true));

        ctx.OwnerProfiles.Add(new OwnerProfile { OwnerId = OwnerId, CreatedAt = now, UpdatedAt = now });
        ctx.JockeyProfiles.AddRange(
            new JockeyProfile
            {
                JockeyId = JockeyId, LicenseCertificate = "LIC-20", ExperienceYears = 5,
                SelfDeclaredWeight = 55m, HealthStatus = "Good", Status = "Active", CreatedAt = now, UpdatedAt = now
            },
            new JockeyProfile
            {
                JockeyId = JockeyId2, LicenseCertificate = "LIC-21", ExperienceYears = 5,
                SelfDeclaredWeight = 55m, HealthStatus = "Good", Status = "Active", CreatedAt = now, UpdatedAt = now
            });
        ctx.DoctorProfiles.Add(new DoctorProfile
        {
            DoctorId = DoctorId, MedicalLicenseNumber = "MED-30", Status = "Active", CreatedAt = now, UpdatedAt = now
        });
        ctx.RefereeProfiles.Add(new RefereeProfile
        {
            RefereeId = RefereeId, CertificationLevel = "National", Status = "Active", CreatedAt = now, UpdatedAt = now
        });

        ctx.Tournaments.AddRange(
            NewTournament(T1, "Giải 1", "Open Registration", now),
            NewTournament(T2, "Giải 2", "Open Registration", now),
            NewTournament(TDone, "Giải cũ", "Completed", now));

        ctx.SaveChanges();
    }

    // =====================================================================
    // Roster: Jockey/Owner/Doctor/Referee đăng ký NHIỀU giải — CHO PHÉP
    // =====================================================================

    [Theory]
    [InlineData(JockeyId, "Jockey")]
    [InlineData(OwnerId, "Owner")]
    [InlineData(DoctorId, "Doctor")]
    [InlineData(RefereeId, "Referee")]
    public async Task Roster_AnyRole_CanRegisterMultipleTournaments(int userId, string role)
    {
        SeedBase();

        using (var ctx = NewContext())
            Assert.True((await NewRosterService(ctx).RegisterAsync(userId, role, T1)).Success);
        using (var ctx = NewContext())
            Assert.True((await NewRosterService(ctx).RegisterAsync(userId, role, T2)).Success);

        using var verify = NewContext();
        Assert.Equal(2, await verify.TournamentParticipants
            .CountAsync(p => p.UserId == userId && p.Role == role));
    }

    [Fact]
    public async Task Roster_DuplicateSameTournament_Blocked()
    {
        SeedBase();
        using (var ctx = NewContext())
            Assert.True((await NewRosterService(ctx).RegisterAsync(JockeyId, "Jockey", T1)).Success);

        using (var ctx = NewContext())
        {
            var second = await NewRosterService(ctx).RegisterAsync(JockeyId, "Jockey", T1);
            Assert.False(second.Success);
        }

        using var verify = NewContext();
        Assert.Equal(1, await verify.TournamentParticipants.CountAsync(p => p.UserId == JockeyId && p.TournamentId == T1));
    }

    // =====================================================================
    // Horse: chặn tham gia >1 giải chưa kết thúc (đối chiếu — vẫn giữ)
    // =====================================================================

    [Fact]
    public async Task Horse_BlockedFromSecondUnfinishedTournament()
    {
        SeedBase();

        // Owner phải có roster Approved ở cả 2 giải trước khi enroll ngựa.
        using (var ctx = NewContext())
        {
            await NewRosterService(ctx).RegisterAsync(OwnerId, "Owner", T1); // Owner auto-Approved
            await NewRosterService(ctx).RegisterAsync(OwnerId, "Owner", T2);
        }

        using (var ctx = NewContext())
        {
            var now = DateTime.UtcNow;
            ctx.Horses.Add(new Horse
            {
                HorseId = 1, OwnerId = OwnerId, Name = "Ngựa Test", BirthYear = 2020, Gender = "Male",
                Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
                VaccinationRecordRef = "VR-1", DopingTestResult = "Clean", LegalConsentAccepted = true,
                Status = "Declared", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                CreatedAt = now, UpdatedAt = now
            });
            ctx.SaveChanges();
        }

        using (var ctx = NewContext())
        {
            var first = await NewHorseService(ctx).EnrollHorseAsync(OwnerId, 1, new EnrollHorseDto { TournamentId = T1 });
            Assert.True(first.Success);
        }

        using (var ctx = NewContext())
        {
            var second = await NewHorseService(ctx).EnrollHorseAsync(OwnerId, 1, new EnrollHorseDto { TournamentId = T2 });
            Assert.False(second.Success); // activeElsewhere chặn (HorseService.cs:155-168)
        }

        using var verify = NewContext();
        Assert.Equal(1, await verify.HorseTournamentEntries.CountAsync(e => e.HorseId == 1 && e.Status == "Enrolled"));
    }

    // =====================================================================
    // Jockey: ràng buộc vật lý thật ở cấp RACE (SCH.8), không phải roster
    // =====================================================================

    [Fact]
    public async Task Jockey_DoubleBooked_SameTimeDifferentRace_Blocked()
    {
        SeedTwoRacesSameTournament(sameScheduledTime: true);

        using (var ctx = NewContext())
            await NewRaceEntryService(ctx).AllocateAsync(AdminId, 101, new AllocateEntryDto { PairingId = 201 });

        using var ctx2 = NewContext();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NewRaceEntryService(ctx2).AllocateAsync(AdminId, 102, new AllocateEntryDto { PairingId = 202 }));
        Assert.Equal("DOUBLE_BOOKED", ex.Message);
    }

    [Fact]
    public async Task Jockey_TwoRacesDifferentTime_NotBlocked()
    {
        SeedTwoRacesSameTournament(sameScheduledTime: false);

        using (var ctx = NewContext())
            await NewRaceEntryService(ctx).AllocateAsync(AdminId, 101, new AllocateEntryDto { PairingId = 201 });

        using var ctx2 = NewContext();
        var result = await NewRaceEntryService(ctx2).AllocateAsync(AdminId, 102, new AllocateEntryDto { PairingId = 202 });
        Assert.Equal("Pending", result.Status); // khác giờ → không bị chặn
    }

    // Seed 1 giải Open + 2 race + 2 pairing chung 1 Jockey (2 ngựa khác nhau).
    private void SeedTwoRacesSameTournament(bool sameScheduledTime)
    {
        SeedBase();
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.TournamentParticipants.AddRange(
            new TournamentParticipant { ParticipantId = 1, TournamentId = T1, UserId = OwnerId, Role = "Owner", Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now },
            new TournamentParticipant { ParticipantId = 2, TournamentId = T1, UserId = JockeyId, Role = "Jockey", Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now });

        ctx.Rounds.Add(new Round
        {
            RoundId = 1, TournamentId = T1, Name = "Vòng loại",
            SequenceOrder = 1, ScheduledDate = now.AddDays(-1), Status = "Upcoming", UpdatedAt = now
        });

        ctx.Races.AddRange(
            new Race { RaceId = 101, RoundId = 1, RaceNumber = 1, ScheduledTime = now.AddHours(48), PurseAmount = 500m, Status = "Upcoming", ConfirmationCutoffHours = 24, ProtestDeadlineMinutes = 120, CreatedAt = now, UpdatedAt = now },
            new Race { RaceId = 102, RoundId = 1, RaceNumber = 2, ScheduledTime = sameScheduledTime ? now.AddHours(48) : now.AddHours(72), PurseAmount = 500m, Status = "Upcoming", ConfirmationCutoffHours = 24, ProtestDeadlineMinutes = 120, CreatedAt = now, UpdatedAt = now });

        for (int i = 0; i < 2; i++)
        {
            int horseId = 301 + i;
            ctx.Horses.Add(new Horse
            {
                HorseId = horseId, OwnerId = OwnerId, Name = $"Ngựa {i}", BirthYear = 2020, Gender = "Male",
                Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
                VaccinationRecordRef = "VR", DopingTestResult = "Clean", LegalConsentAccepted = true,
                Status = "Declared", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                CreatedAt = now, UpdatedAt = now
            });
            ctx.HorseTournamentEntries.Add(new HorseTournamentEntry
            {
                EnrollmentId = 401 + i, HorseId = horseId, TournamentId = T1, OwnerId = OwnerId,
                Status = "Enrolled", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                CreatedAt = now, UpdatedAt = now
            });
            // Cùng 1 Jockey cho cả 2 pairing → allocate race 2 sẽ đụng double-booking.
            ctx.Pairings.Add(new Pairing
            {
                PairingId = 201 + i, TournamentId = T1, HorseId = horseId, JockeyId = JockeyId,
                Status = "Confirmed", CreatedAt = now, UpdatedAt = now
            });
        }

        ctx.SaveChanges();
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private static Tournament NewTournament(int id, string name, string status, DateTime now) => new()
    {
        TournamentId = id, Name = name, StartDate = now.AddDays(-1), EndDate = now.AddDays(30),
        MaxHorses = 24, AllowedBreed = "Thoroughbred", TrackType = "Turf", RaceDistance = 1600,
        RaceCategory = "Open", MinJockeyExperienceYears = 1, PurseAmount = 1000m, EntryFeeAmount = 10m,
        PreRaceWeightThresholdKg = 2m, PostRaceWeightDiffThresholdKg = 2m, Status = status,
        CreatedAt = now, UpdatedAt = now
    };

    private static User NewUser(int id, string username, string role, DateTime now, bool withIdentity) => new()
    {
        UserId = id, Username = username, FullName = username,
        Email = $"{username}@test.local", NormalizedEmail = $"{username.ToUpperInvariant()}@TEST.LOCAL",
        PasswordHash = "x", Role = role, Status = "Active",
        PhoneNumber = withIdentity ? "0900000000" : null,
        DateOfBirth = withIdentity ? new DateTime(1990, 1, 1) : null,
        IdentityHash = withIdentity ? new byte[] { 1, 2, 3 } : null,
        CreatedAt = now, UpdatedAt = now
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
