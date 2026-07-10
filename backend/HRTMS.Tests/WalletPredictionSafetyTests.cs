using System.Security.Cryptography;
using System.Text;
using HRTMS.Core.DTOs.Prediction;
using HRTMS.Core.DTOs.Result;
using HRTMS.Core.DTOs.Wallet;
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
/// Module M hardening: wallet missing không silent (Declare Official rollback),
/// prediction chỉ trên entry Confirmed, identity gate khi redeem ticket code.
/// SQLite in-memory (relational) — cùng pattern các test khác.
/// </summary>
public sealed class WalletPredictionSafetyTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerId = 10;
    private const int JockeyId = 20;
    private const int RefereeId = 25;
    private const int SpectatorNoWalletId = 30;
    private const int SpectatorWithWalletId = 31;

    private const int TournamentId = 1;
    private const int RoundId = 1;
    private const int RaceId = 1;
    private const int EntryId = 1;

    private const int WalletStartBalance = 500;

    private readonly SqliteConnection _conn;

    public WalletPredictionSafetyTests()
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

    private static byte[] Hash(string value) => SHA256.HashData(Encoding.UTF8.GetBytes(value.Trim()));

    private static PredictionService NewPredictionService(HRTMSDbContext ctx) =>
        new(ctx, new NoOpAuditLog(), new NoOpNotification());

    private static ResultService NewResultService(HRTMSDbContext ctx) =>
        new(ctx, new NoOpAuditLog(), new NoOpNotification());

    private static WalletService NewWalletService(HRTMSDbContext ctx) =>
        new(ctx, new NoOpAuditLog());

    // =====================================================================
    // Seed
    // =====================================================================
    private void Seed(
        string raceStatus = "Upcoming",
        bool drawn = true,
        string entryStatus = "Confirmed",
        bool withRaceReport = false,
        bool spectatorNoWalletHasPendingPrediction = false,
        bool spectatorWithWalletHasPendingPrediction = false,
        bool spectatorWithIdentity = true)
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.Users.AddRange(
            NewUser(AdminId, "admin", "Admin", now, withIdentity: true),
            NewUser(OwnerId, "owner", "Owner", now, withIdentity: true),
            NewUser(JockeyId, "jockey", "Jockey", now, withIdentity: true),
            NewUser(RefereeId, "referee", "Referee", now, withIdentity: true),
            NewUser(SpectatorNoWalletId, "specA", "Spectator", now, withIdentity: true),
            NewUser(SpectatorWithWalletId, "specB", "Spectator", now, withIdentity: spectatorWithIdentity));

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

        // Spectator A: KHÔNG có Wallet (dữ liệu lỗi để test rollback).
        ctx.SpectatorProfiles.Add(new SpectatorProfile { SpectatorId = SpectatorNoWalletId, CreatedAt = now });
        // Spectator B: có Wallet bình thường.
        ctx.SpectatorProfiles.Add(new SpectatorProfile { SpectatorId = SpectatorWithWalletId, CreatedAt = now });
        ctx.Wallets.Add(new Wallet
        {
            WalletId = 1, SpectatorId = SpectatorWithWalletId, Balance = WalletStartBalance, UpdatedAt = now
        });

        ctx.Tournaments.Add(new Tournament
        {
            TournamentId = TournamentId, Name = "Giải Test", StartDate = now.AddDays(-1), EndDate = now.AddDays(30),
            MaxHorses = 24, AllowedBreed = "Thoroughbred", TrackType = "Turf", RaceDistance = 1600,
            RaceCategory = "Open", MinJockeyExperienceYears = 1, PurseAmount = 1000m, EntryFeeAmount = 0m,
            PreRaceWeightThresholdKg = 2m, PostRaceWeightDiffThresholdKg = 2m, Status = "Closed Registration",
            CreatedAt = now, UpdatedAt = now
        });
        for (var pos = 1; pos <= 5; pos++)
            ctx.PrizeDistributions.Add(new PrizeDistribution
            {
                TournamentId = TournamentId, Position = pos, Percentage = 20m, CreatedAt = now, UpdatedAt = now
            });

        ctx.Rounds.Add(new Round
        {
            RoundId = RoundId, TournamentId = TournamentId, Name = "Vòng loại",
            SequenceOrder = 1, ScheduledDate = now.AddDays(-1), Status = "Upcoming", UpdatedAt = now
        });
        ctx.Races.Add(new Race
        {
            RaceId = RaceId, RoundId = RoundId, RaceNumber = 1, ScheduledTime = now.AddHours(48),
            PurseAmount = 500m, Status = raceStatus, IsPostPositionDrawn = drawn,
            IsPredictionGateClosed = false, ConfirmationCutoffHours = 24, ProtestDeadlineMinutes = 120,
            CreatedAt = now, UpdatedAt = now
        });

        if (withRaceReport)
            ctx.RaceReports.Add(new RaceReport
            {
                RaceReportId = 1, RaceId = RaceId, LeadRefereeId = RefereeId,
                IsLocked = false, SubmittedAt = now
            });

        ctx.Horses.Add(new Horse
        {
            HorseId = 1, OwnerId = OwnerId, Name = "Ngựa Test", BirthYear = 2020, Gender = "Male",
            Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
            VaccinationRecordRef = "VR-1", DopingTestResult = "Clean", LegalConsentAccepted = true,
            Status = "Declared", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
            CreatedAt = now, UpdatedAt = now
        });
        ctx.TournamentParticipants.Add(new TournamentParticipant
        {
            ParticipantId = 1, TournamentId = TournamentId, UserId = JockeyId, Role = "Jockey",
            Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now
        });
        ctx.HorseTournamentEntries.Add(new HorseTournamentEntry
        {
            EnrollmentId = 1, HorseId = 1, TournamentId = TournamentId, OwnerId = OwnerId,
            Status = "Enrolled", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
            CreatedAt = now, UpdatedAt = now
        });
        ctx.Pairings.Add(new Pairing
        {
            PairingId = 1, TournamentId = TournamentId, HorseId = 1, JockeyId = JockeyId,
            Status = "Confirmed", CreatedAt = now, UpdatedAt = now
        });
        ctx.RaceEntries.Add(new RaceEntry
        {
            RaceEntryId = EntryId, RaceId = RaceId, PairingId = 1, PostPosition = 1,
            Status = entryStatus, EntryFeeStatus = "Paid",
            FinishPosition = raceStatus == "Unofficial" ? 1 : null,
            PostRaceJockeyWeight = raceStatus == "Unofficial" ? 54m : null,
            IsWithdrawn = false, CreatedAt = now, UpdatedAt = now
        });

        var predictionId = 1;
        if (spectatorNoWalletHasPendingPrediction)
            ctx.Predictions.Add(new Prediction
            {
                PredictionId = predictionId++, SpectatorId = SpectatorNoWalletId, RaceId = RaceId,
                RaceEntryId = EntryId, PredictionType = "Win", PointsPlaced = 50,
                Status = "Pending", CreatedAt = now
            });
        if (spectatorWithWalletHasPendingPrediction)
            ctx.Predictions.Add(new Prediction
            {
                PredictionId = predictionId, SpectatorId = SpectatorWithWalletId, RaceId = RaceId,
                RaceEntryId = EntryId, PredictionType = "Win", PointsPlaced = 60,
                Status = "Pending", CreatedAt = now
            });

        ctx.SaveChanges();
    }

    // =====================================================================
    // Prediction: chỉ entry Confirmed
    // =====================================================================

    [Fact]
    public async Task PlacePrediction_PendingEntry_Blocked()
    {
        Seed(entryStatus: "Pending");
        using var ctx = NewContext();
        var result = await NewPredictionService(ctx).PlacePredictionAsync(
            SpectatorWithWalletId,
            new PlacePredictionDto { RaceId = RaceId, RaceEntryId = EntryId, PointsPlaced = 50 }, null);

        Assert.False(result.Success);
        Assert.Contains("chưa được xác nhận", result.Message);

        using var verify = NewContext();
        Assert.Equal(WalletStartBalance,
            (await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorWithWalletId)).Balance);
        Assert.Equal(0, await verify.Predictions.CountAsync());
    }

    [Fact]
    public async Task PlacePrediction_ConfirmedEntry_Succeeds()
    {
        Seed(entryStatus: "Confirmed");
        using var ctx = NewContext();
        var result = await NewPredictionService(ctx).PlacePredictionAsync(
            SpectatorWithWalletId,
            new PlacePredictionDto { RaceId = RaceId, RaceEntryId = EntryId, PointsPlaced = 50 }, null);

        Assert.True(result.Success);

        using var verify = NewContext();
        Assert.Equal(WalletStartBalance - 50,
            (await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorWithWalletId)).Balance);
        Assert.Equal(1, await verify.VirtualPointsTransactions.CountAsync(t => t.Type == "Prediction Placed"));
    }

    // =====================================================================
    // Declare Official: wallet thiếu → rollback toàn bộ, không partial
    // =====================================================================

    [Fact]
    public async Task DeclareOfficial_MissingWallet_RollsBackEverything()
    {
        Seed(raceStatus: "Unofficial", withRaceReport: true,
             spectatorNoWalletHasPendingPrediction: true,
             spectatorWithWalletHasPendingPrediction: true);

        using (var ctx = NewContext())
        {
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                NewResultService(ctx).DeclareOfficialAsync(
                    RaceId, new DeclareOfficialDto { ConfirmedByAdmin = true }, AdminId));
            Assert.Equal("WALLET_NOT_FOUND", ex.Message);
        }

        using var verify = NewContext();
        // Race + biên bản không đổi trạng thái.
        Assert.Equal("Unofficial", (await verify.Races.SingleAsync()).Status);
        Assert.False((await verify.RaceReports.SingleAsync()).IsLocked);
        // Không có payout/ledger/reward partial nào được ghi.
        Assert.Equal(0, await verify.PursePayouts.CountAsync());
        Assert.Equal(0, await verify.VirtualPointsTransactions.CountAsync());
        // Cả hai prediction vẫn Pending; ví của spectator hợp lệ không bị cộng lẻ.
        Assert.Equal(2, await verify.Predictions.CountAsync(p => p.Status == "Pending"));
        Assert.Equal(WalletStartBalance,
            (await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorWithWalletId)).Balance);
    }

    // =====================================================================
    // Redeem: identity gate
    // =====================================================================

    [Fact]
    public async Task Redeem_MissingIdentity_Blocked()
    {
        Seed(spectatorWithIdentity: false);
        using (var ctx = NewContext())
        {
            ctx.TicketRewardCodes.Add(new TicketRewardCode
            {
                CodeHash = Hash("TKT-TESTCODE0001"), PointAmount = 200, Status = "Active",
                ExpiresAt = DateTime.UtcNow.AddDays(7), CreatedAt = DateTime.UtcNow
            });
            ctx.SaveChanges();
        }

        using var ctx2 = NewContext();
        var result = await NewWalletService(ctx2).RedeemTicketCodeAsync(
            SpectatorWithWalletId, new RedeemTicketCodeDto { Code = "TKT-TESTCODE0001" }, null);

        Assert.False(result.Success);
        Assert.Contains("bổ sung số điện thoại", result.Message);

        using var verify = NewContext();
        Assert.Equal("Active", (await verify.TicketRewardCodes.SingleAsync()).Status);
        Assert.Equal(WalletStartBalance,
            (await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorWithWalletId)).Balance);
    }

    [Fact]
    public async Task Redeem_WithIdentity_Succeeds()
    {
        Seed(spectatorWithIdentity: true);
        using (var ctx = NewContext())
        {
            ctx.TicketRewardCodes.Add(new TicketRewardCode
            {
                CodeHash = Hash("TKT-TESTCODE0002"), PointAmount = 200, Status = "Active",
                ExpiresAt = DateTime.UtcNow.AddDays(7), CreatedAt = DateTime.UtcNow
            });
            ctx.SaveChanges();
        }

        using var ctx2 = NewContext();
        var result = await NewWalletService(ctx2).RedeemTicketCodeAsync(
            SpectatorWithWalletId, new RedeemTicketCodeDto { Code = "TKT-TESTCODE0002" }, null);

        Assert.True(result.Success);

        using var verify = NewContext();
        Assert.Equal(WalletStartBalance + 200,
            (await verify.Wallets.SingleAsync(w => w.SpectatorId == SpectatorWithWalletId)).Balance);
    }

    // =====================================================================
    // Stubs & helpers
    // =====================================================================

    private static User NewUser(int id, string username, string role, DateTime now, bool withIdentity) => new()
    {
        UserId = id, Username = username, FullName = username,
        Email = $"{username}@test.local", NormalizedEmail = $"{username.ToUpperInvariant()}@TEST.LOCAL",
        PasswordHash = "x", Role = role, Status = "Active",
        PhoneNumber = withIdentity ? $"09000000{id:D2}" : null,
        IdentityHash = withIdentity ? Hash($"0010900000{id:D2}") : null,
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
