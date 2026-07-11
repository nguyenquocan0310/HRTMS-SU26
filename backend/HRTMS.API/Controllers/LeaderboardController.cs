using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Leaderboard;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

// Module L — LDR.1/2/3/4.
// Public (AllowAnonymous): leaderboard là dữ liệu công khai cho spectator theo dõi.
// FE polling ~30s, KHÔNG dùng WebSocket — endpoint giữ nhẹ, AsNoTracking ở service.
[Tags("leaderboard")]
[ApiController]
[Route("api/leaderboard")]
[AllowAnonymous]
public class LeaderboardController : ControllerBase
{
    private readonly ILeaderboardService _leaderboardService;

    public LeaderboardController(ILeaderboardService leaderboardService)
    {
        _leaderboardService = leaderboardService;
    }

    // GET /api/leaderboard/horses?tournamentId=1&mode=points|earnings
    [HttpGet("horses")]
    public async Task<IActionResult> GetHorseLeaderboard(
        [FromQuery] int tournamentId,
        [FromQuery] string mode = LeaderboardMode.Points)
    {
        if (!LeaderboardMode.IsValid(mode))
            return BadRequest(ApiResponse<object>.Fail(
                "INVALID_MODE: mode phải là 'points' hoặc 'earnings'."));

        try
        {
            var data = await _leaderboardService.GetHorseLeaderboardAsync(tournamentId, mode);
            return Ok(ApiResponse<List<HorseLeaderboardEntryDto>>.Ok(data));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "TOURNAMENT_NOT_FOUND")
        {
            return NotFound(ApiResponse<object>.Fail("Không tìm thấy giải đấu."));
        }
    }

    // GET /api/leaderboard/jockeys?tournamentId=1&mode=points|earnings
    [HttpGet("jockeys")]
    public async Task<IActionResult> GetJockeyLeaderboard(
        [FromQuery] int tournamentId,
        [FromQuery] string mode = LeaderboardMode.Points)
    {
        if (!LeaderboardMode.IsValid(mode))
            return BadRequest(ApiResponse<object>.Fail(
                "INVALID_MODE: mode phải là 'points' hoặc 'earnings'."));

        try
        {
            var data = await _leaderboardService.GetJockeyLeaderboardAsync(tournamentId, mode);
            return Ok(ApiResponse<List<JockeyLeaderboardEntryDto>>.Ok(data));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "TOURNAMENT_NOT_FOUND")
        {
            return NotFound(ApiResponse<object>.Fail("Không tìm thấy giải đấu."));
        }
    }
}