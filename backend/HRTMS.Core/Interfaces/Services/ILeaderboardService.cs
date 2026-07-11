using HRTMS.Core.DTOs.Leaderboard;

namespace HRTMS.Core.Interfaces.Services;

public interface ILeaderboardService
{
    // Throws KeyNotFoundException("TOURNAMENT_NOT_FOUND") nếu tournamentId không tồn tại
    Task<List<HorseLeaderboardEntryDto>> GetHorseLeaderboardAsync(int tournamentId, string mode);
    Task<List<JockeyLeaderboardEntryDto>> GetJockeyLeaderboardAsync(int tournamentId, string mode);
}