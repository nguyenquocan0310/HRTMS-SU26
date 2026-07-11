using HRTMS.Core.DTOs.Leaderboard;
using HRTMS.Core.Entities;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRTMS.Tests;

/// <summary>
/// Module L — Leaderboard. Chỉ đọc trên dữ liệu PointsAwarded/EarningsAwarded
/// đã được ResultService.DeclareOfficialAsync ghi sẵn khi Race chuyển Official.
/// Test này seed thẳng dữ liệu "đã Official" (không gọi DeclareOfficialAsync)
/// để cô lập, chỉ verify logic GROUP BY / filter / sort / rank của LeaderboardService.
/// </summary>
public sealed class LeaderboardServiceTests : IDisposable
{
    private const int OwnerId = 10;
    private const int JockeyAId = 20;
    private const int JockeyBId = 21;
    private const int TournamentId = 1;
    private const int OtherTournamentId = 2;
    private const int RoundId = 1;

    private readonly SqliteConnection _conn;

    public LeaderboardServiceTests()
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

    private static User NewUser(int id, string username, string role, DateTime now) => new()
    {
        UserId = id, Username = username, FullName = username,
        Email = $"{username}@test.local", NormalizedEmail = $"{username.ToUpperInvariant()}@TEST.LOCAL",
        PasswordHash = "x", Role = role, Status = "Active", CreatedAt = now, UpdatedAt = now
    };

    // =====================================================================
    // Seed dùng chung: 1 giải, 2 jockey, N ngựa, mỗi ngựa 1 RaceEntry ở 1 race
    // với Status/FinishPosition/PointsAwarded/EarningsAwarded/RaceStatus tùy biến.
    // =====================================================================
    private sealed record EntrySeed(
        int HorseId, int JockeyId, int? FinishPosition,
        int? Points, decimal? Earnings, string EntryStatus, string RaceStatus, int TournamentId = TournamentId);

	private void Seed(IEnumerable<EntrySeed> seeds)
	{
		using var ctx = NewContext();
		var now = DateTime.UtcNow;

		ctx.Users.AddRange(
			NewUser(OwnerId, "owner", "Owner", now),
			NewUser(JockeyAId, "jockeyA", "Jockey", now),
			NewUser(JockeyBId, "jockeyB", "Jockey", now));
		ctx.OwnerProfiles.Add(new OwnerProfile { OwnerId = OwnerId, CreatedAt = now, UpdatedAt = now });
		ctx.JockeyProfiles.Add(new JockeyProfile
		{
			JockeyId = JockeyAId,
			LicenseCertificate = "LIC-A",
			ExperienceYears = 5,
			SelfDeclaredWeight = 55m,
			Status = "Active",
			CreatedAt = now,
			UpdatedAt = now
		});
		ctx.JockeyProfiles.Add(new JockeyProfile
		{
			JockeyId = JockeyBId,
			LicenseCertificate = "LIC-B",
			ExperienceYears = 3,
			SelfDeclaredWeight = 56m,
			Status = "Active",
			CreatedAt = now,
			UpdatedAt = now
		});

		foreach (var tid in new[] { TournamentId, OtherTournamentId })
		{
			ctx.Tournaments.Add(new Tournament
			{
				TournamentId = tid,
				Name = $"Giải {tid}",
				StartDate = now.AddDays(-10),
				EndDate = now.AddDays(30),
				MaxHorses = 24,
				AllowedBreed = "Thoroughbred",
				TrackType = "Turf",
				RaceDistance = 1600,
				RaceCategory = "Open",
				MinJockeyExperienceYears = 1,
				PurseAmount = 1000m,
				EntryFeeAmount = 0m,
				PreRaceWeightThresholdKg = 2m,
				PostRaceWeightDiffThresholdKg = 2m,
				Status = "Closed Registration",
				CreatedAt = now,
				UpdatedAt = now
			});
			ctx.Rounds.Add(new Round
			{
				RoundId = tid,
				TournamentId = tid,
				Name = "Vòng loại",
				SequenceOrder = 1,
				ScheduledDate = now.AddDays(-1),
				Status = "Upcoming",
				UpdatedAt = now
			});

			// NEW: TournamentParticipant cho mỗi jockey trong mỗi giải — Pairing có FK
			// composite (TournamentId, JockeyId) -> TournamentParticipant (TournamentId, UserId).
			var participantId = tid * 100;
			foreach (var jockeyId in new[] { JockeyAId, JockeyBId })
			{
				ctx.TournamentParticipants.Add(new TournamentParticipant
				{
					ParticipantId = participantId++,
					TournamentId = tid,
					UserId = jockeyId,
					Role = "Jockey",
					Status = "Approved",
					ScreeningStatus = "AutoEligible",
					RegisteredAt = now
				});
			}
		}

		var raceId = 1;
		var horseId = 1;
		var pairingId = 1;
		var entryId = 1;

		foreach (var s in seeds)
		{
			var thisRaceId = raceId++;
            ctx.Races.Add(new Race
            {
                RaceId = thisRaceId, RoundId = s.TournamentId == TournamentId ? RoundId : OtherTournamentId,
                RaceNumber = thisRaceId, ScheduledTime = now.AddHours(-1), PurseAmount = 1000m,
                Status = s.RaceStatus, ConfirmationCutoffHours = 24, ProtestDeadlineMinutes = 120,
                CreatedAt = now, UpdatedAt = now
            });

            var thisHorseId = s.HorseId != 0 ? s.HorseId : horseId;
            if (!ctx.Horses.Local.Any(h => h.HorseId == thisHorseId) &&
                !ctx.Horses.Any(h => h.HorseId == thisHorseId))
            {
                ctx.Horses.Add(new Horse
                {
                    HorseId = thisHorseId, OwnerId = OwnerId, Name = $"Ngựa {thisHorseId}", BirthYear = 2020,
                    Gender = "Male", Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
                    VaccinationRecordRef = "VR-1", DopingTestResult = "Clean", LegalConsentAccepted = true,
                    Status = "Declared", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
                    CreatedAt = now, UpdatedAt = now
                });
            }
            horseId = Math.Max(horseId, thisHorseId + 1);

            var thisPairingId = pairingId++;
            ctx.Pairings.Add(new Pairing
            {
                PairingId = thisPairingId, TournamentId = s.TournamentId, HorseId = thisHorseId,
                JockeyId = s.JockeyId, Status = "Confirmed", CreatedAt = now, UpdatedAt = now
            });

            ctx.RaceEntries.Add(new RaceEntry
            {
                RaceEntryId = entryId++, RaceId = thisRaceId, PairingId = thisPairingId, PostPosition = 1,
                Status = s.EntryStatus, EntryFeeStatus = "Paid", FinishPosition = s.FinishPosition,
                PointsAwarded = s.Points, EarningsAwarded = s.Earnings,
                IsWithdrawn = s.EntryStatus == "Cancelled", CreatedAt = now, UpdatedAt = now
            });
        }

        ctx.SaveChanges();
    }

    // =====================================================================
    // Filter: chỉ tính race Official
    // =====================================================================

    [Fact]
    public async Task GetHorseLeaderboard_IgnoresNonOfficialRaces()
    {
        Seed([
            new EntrySeed(1, JockeyAId, 1, 10, 400m, "Confirmed", "Official"),
            new EntrySeed(2, JockeyAId, 1, 10, 400m, "Confirmed", "Unofficial"), // chưa Official -> bỏ qua
            new EntrySeed(3, JockeyAId, 1, 10, 400m, "Confirmed", "Live"),       // chưa Official -> bỏ qua
        ]);

        using var ctx = NewContext();
        var svc = new LeaderboardService(ctx);
        var result = await svc.GetHorseLeaderboardAsync(TournamentId, LeaderboardMode.Points);

        var entry = Assert.Single(result);
        Assert.Equal(1, entry.HorseId);
        Assert.Equal(1, entry.Races);
    }

    // =====================================================================
    // Filter: loại Cancelled/Disqualified dù race đã Official
    // =====================================================================

    [Fact]
    public async Task GetHorseLeaderboard_ExcludesCancelledAndDisqualifiedEntries()
    {
        Seed([
            new EntrySeed(1, JockeyAId, 1, 10, 400m, "Confirmed", "Official"),
            new EntrySeed(2, JockeyAId, null, null, null, "Cancelled", "Official"),
            new EntrySeed(3, JockeyAId, null, null, null, "Disqualified", "Official"),
        ]);

        using var ctx = NewContext();
        var svc = new LeaderboardService(ctx);
        var result = await svc.GetHorseLeaderboardAsync(TournamentId, LeaderboardMode.Points);

        var entry = Assert.Single(result);
        Assert.Equal(1, entry.HorseId);
    }

    // =====================================================================
    // Jockey đổi ngựa qua nhiều race trong cùng giải -> gộp về 1 dòng
    // =====================================================================

    [Fact]
    public async Task GetJockeyLeaderboard_AggregatesAcrossMultipleHorsesSameJockey()
    {
        Seed([
            new EntrySeed(1, JockeyAId, 1, 10, 400m, "Confirmed", "Official"),
            new EntrySeed(2, JockeyAId, 2, 5, 250m, "Confirmed", "Official"), // Jockey A đổi sang ngựa khác
            new EntrySeed(3, JockeyBId, 1, 10, 400m, "Confirmed", "Official"),
        ]);

        using var ctx = NewContext();
        var svc = new LeaderboardService(ctx);
        var result = await svc.GetJockeyLeaderboardAsync(TournamentId, LeaderboardMode.Points);

        Assert.Equal(2, result.Count);

        var jockeyA = result.Single(x => x.JockeyId == JockeyAId);
        Assert.Equal(2, jockeyA.Races);
        Assert.Equal(1, jockeyA.Wins);
        Assert.Equal(15, jockeyA.TotalPoints);
        Assert.Equal(650m, jockeyA.TotalEarnings);
        Assert.Equal(0.5, jockeyA.WinRate, 4);

        var jockeyB = result.Single(x => x.JockeyId == JockeyBId);
        Assert.Equal(1, jockeyB.Races);
        Assert.Equal(1.0, jockeyB.WinRate, 4);
    }

    // =====================================================================
    // Sort: mode=points vs mode=earnings cho thứ tự khác nhau
    // =====================================================================

    [Fact]
    public async Task GetHorseLeaderboard_SortsByRequestedMode()
    {
        Seed([
            // Ngựa 1: điểm cao hơn nhưng tiền thấp hơn ngựa 2
            new EntrySeed(1, JockeyAId, 1, 10, 100m, "Confirmed", "Official"),
            new EntrySeed(2, JockeyAId, 2, 5, 900m, "Confirmed", "Official"),
        ]);

        using var ctx1 = NewContext();
        var byPoints = await new LeaderboardService(ctx1)
            .GetHorseLeaderboardAsync(TournamentId, LeaderboardMode.Points);
        Assert.Equal(1, byPoints[0].HorseId);
        Assert.Equal(1, byPoints[0].Rank);
        Assert.Equal(2, byPoints[1].HorseId);

        using var ctx2 = NewContext();
        var byEarnings = await new LeaderboardService(ctx2)
            .GetHorseLeaderboardAsync(TournamentId, LeaderboardMode.Earnings);
        Assert.Equal(2, byEarnings[0].HorseId);
        Assert.Equal(1, byEarnings[0].Rank);
        Assert.Equal(1, byEarnings[1].HorseId);
    }

    // =====================================================================
    // Cách ly giữa các giải — không lẫn dữ liệu tournament khác
    // =====================================================================

    [Fact]
    public async Task GetHorseLeaderboard_ScopedToRequestedTournamentOnly()
    {
        Seed([
            new EntrySeed(1, JockeyAId, 1, 10, 400m, "Confirmed", "Official", TournamentId),
            new EntrySeed(2, JockeyAId, 1, 10, 400m, "Confirmed", "Official", OtherTournamentId),
        ]);

        using var ctx = NewContext();
        var svc = new LeaderboardService(ctx);
        var result = await svc.GetHorseLeaderboardAsync(TournamentId, LeaderboardMode.Points);

        var entry = Assert.Single(result);
        Assert.Equal(1, entry.HorseId);
    }

    // =====================================================================
    // Giải không tồn tại -> throw để controller trả 404 (không phải 500)
    // =====================================================================

    [Fact]
    public async Task GetHorseLeaderboard_ThrowsWhenTournamentNotFound()
    {
        Seed([new EntrySeed(1, JockeyAId, 1, 10, 400m, "Confirmed", "Official")]);

        using var ctx = NewContext();
        var svc = new LeaderboardService(ctx);

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => svc.GetHorseLeaderboardAsync(9999, LeaderboardMode.Points));
    }

    // =====================================================================
    // Giải chưa có race Official nào -> trả về mảng rỗng, không lỗi
    // =====================================================================

    [Fact]
    public async Task GetHorseLeaderboard_ReturnsEmptyList_WhenNoOfficialRaces()
    {
        Seed([new EntrySeed(1, JockeyAId, 1, 10, 400m, "Confirmed", "Live")]);

        using var ctx = NewContext();
        var svc = new LeaderboardService(ctx);
        var result = await svc.GetHorseLeaderboardAsync(TournamentId, LeaderboardMode.Points);

        Assert.Empty(result);
    }
}