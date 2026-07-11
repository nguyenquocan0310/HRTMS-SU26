using HRTMS.Core.DTOs.Leaderboard;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

// Module L — Leaderboard. CHỈ ĐỌC. Không ghi PointsAwarded/EarningsAwarded
// (đã được ResultService.DeclareOfficialAsync ghi khi race chuyển Official).
// Scope theo giải qua Pairing.TournamentId (không qua Race->Round->Tournament),
// vì Pairing đã có FK TournamentId trực tiếp.
//
// LƯU Ý: Microsoft.Data.Sqlite (dùng trong test) KHÔNG dịch được Sum(decimal) sang SQL
// ("SQLite cannot apply aggregate operator 'Sum' on expressions of type 'decimal'").
// SQL Server thật thì dịch được, nhưng để code chạy đúng trên cả 2 provider,
// ta lấy dữ liệu thô qua ToListAsync() trước, rồi GroupBy/Sum bằng LINQ to Objects.
public class LeaderboardService : ILeaderboardService
{
	private static readonly string[] ExcludedEntryStatuses = { "Cancelled", "Disqualified" };

	private readonly HRTMSDbContext _context;

	public LeaderboardService(HRTMSDbContext context)
	{
		_context = context;
	}

	private sealed record HorseRow(int HorseId, string? HorseName, int? FinishPosition, int? Points, decimal? Earnings);
	private sealed record JockeyRow(int JockeyId, string? JockeyName, int? FinishPosition, int? Points, decimal? Earnings);

	public async Task<List<HorseLeaderboardEntryDto>> GetHorseLeaderboardAsync(int tournamentId, string mode)
	{
		await EnsureTournamentExistsAsync(tournamentId);

		var rows = await (
			from re in _context.RaceEntries.AsNoTracking()
			join pairing in _context.Pairings.AsNoTracking() on re.PairingId equals pairing.PairingId
			join race in _context.Races.AsNoTracking() on re.RaceId equals race.RaceId
			join horse in _context.Horses.AsNoTracking() on pairing.HorseId equals horse.HorseId
			where pairing.TournamentId == tournamentId
				  && race.Status == "Official"
				  && !ExcludedEntryStatuses.Contains(re.Status)
			select new HorseRow(horse.HorseId, horse.Name, re.FinishPosition, re.PointsAwarded, re.EarningsAwarded)
		).ToListAsync();

		var grouped = rows
			.GroupBy(x => new { x.HorseId, x.HorseName })
			.Select(g => new HorseLeaderboardEntryDto
			{
				HorseId = g.Key.HorseId,
				HorseName = g.Key.HorseName,
				Races = g.Count(),
				Wins = g.Count(x => x.FinishPosition == 1),
				TotalPoints = g.Sum(x => x.Points ?? 0),
				TotalEarnings = g.Sum(x => x.Earnings ?? 0m)
			})
			.ToList();

		foreach (var e in grouped)
			e.WinRate = e.Races > 0 ? (double)e.Wins / e.Races : 0;

		return RankAndSort(grouped, mode);
	}

	public async Task<List<JockeyLeaderboardEntryDto>> GetJockeyLeaderboardAsync(int tournamentId, string mode)
	{
		await EnsureTournamentExistsAsync(tournamentId);

		var rows = await (
			from re in _context.RaceEntries.AsNoTracking()
			join pairing in _context.Pairings.AsNoTracking() on re.PairingId equals pairing.PairingId
			join race in _context.Races.AsNoTracking() on re.RaceId equals race.RaceId
			join jockey in _context.Users.AsNoTracking() on pairing.JockeyId equals jockey.UserId
			where pairing.TournamentId == tournamentId
				  && race.Status == "Official"
				  && !ExcludedEntryStatuses.Contains(re.Status)
			select new JockeyRow(jockey.UserId, jockey.FullName, re.FinishPosition, re.PointsAwarded, re.EarningsAwarded)
		).ToListAsync();

		var grouped = rows
			.GroupBy(x => new { x.JockeyId, x.JockeyName })
			.Select(g => new JockeyLeaderboardEntryDto
			{
				JockeyId = g.Key.JockeyId,
				JockeyName = g.Key.JockeyName,
				Races = g.Count(),
				Wins = g.Count(x => x.FinishPosition == 1),
				TotalPoints = g.Sum(x => x.Points ?? 0),
				TotalEarnings = g.Sum(x => x.Earnings ?? 0m)
			})
			.ToList();

		foreach (var e in grouped)
			e.WinRate = e.Races > 0 ? (double)e.Wins / e.Races : 0;

		return RankAndSort(grouped, mode);
	}

	private async Task EnsureTournamentExistsAsync(int tournamentId)
	{
		var exists = await _context.Tournaments.AsNoTracking()
			.AnyAsync(t => t.TournamentId == tournamentId);

		if (!exists)
			throw new KeyNotFoundException("TOURNAMENT_NOT_FOUND");
	}

	private static List<HorseLeaderboardEntryDto> RankAndSort(List<HorseLeaderboardEntryDto> list, string mode)
	{
		var ordered = mode == LeaderboardMode.Earnings
			? list.OrderByDescending(x => x.TotalEarnings).ThenByDescending(x => x.TotalPoints).ToList()
			: list.OrderByDescending(x => x.TotalPoints).ThenByDescending(x => x.TotalEarnings).ToList();

		for (var i = 0; i < ordered.Count; i++)
			ordered[i].Rank = i + 1;

		return ordered;
	}

	private static List<JockeyLeaderboardEntryDto> RankAndSort(List<JockeyLeaderboardEntryDto> list, string mode)
	{
		var ordered = mode == LeaderboardMode.Earnings
			? list.OrderByDescending(x => x.TotalEarnings).ThenByDescending(x => x.TotalPoints).ToList()
			: list.OrderByDescending(x => x.TotalPoints).ThenByDescending(x => x.TotalEarnings).ToList();

		for (var i = 0; i < ordered.Count; i++)
			ordered[i].Rank = i + 1;

		return ordered;
	}
}