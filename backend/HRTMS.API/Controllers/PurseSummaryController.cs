using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Purse;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace HRTMS.API.Controllers
{
    /// <summary>
    /// Module K — Quỹ thưởng tổng hợp cấp Giải đấu/Vòng đấu/Cuộc đua (PRZ.5, UI-S14).
    /// Chỉ đọc — không chỉnh sửa payout ở đây (xem <see cref="PursePayoutController"/>).
    /// RBAC (Admin đầy đủ; Owner/Jockey chỉ khi có ngựa/cặp đấu trong phạm vi;
    /// Spectator không được xem — đồng bộ ReportService) nằm trong service, controller
    /// chỉ đọc claims và map exception → status code.
    /// </summary>
    [Tags("purse-summary")]
    [ApiController]
    [Authorize]
    public class PurseSummaryController : ControllerBase
    {
        private readonly IPursePayoutService _payoutService;

        public PurseSummaryController(IPursePayoutService payoutService)
        {
            _payoutService = payoutService;
        }

        // userId/role LUÔN lấy từ claims — không nhận từ query string.
        private (int UserId, string Role) GetIdentity() =>
            (int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!),
             User.FindFirstValue(ClaimTypes.Role) ?? string.Empty);

        // =====================================================================
        // GET /api/tournament/{tournamentId}/purse-summary
        // =====================================================================
        [HttpGet("api/tournament/{tournamentId:int}/purse-summary")]
        public async Task<ActionResult<ApiResponse<TournamentPurseSummaryDto>>> GetTournamentPurseSummary(int tournamentId)
        {
            var (userId, role) = GetIdentity();
            try
            {
                var result = await _payoutService.GetTournamentPurseSummaryAsync(tournamentId, userId, role);
                return Ok(ApiResponse<TournamentPurseSummaryDto>.Ok(result));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<TournamentPurseSummaryDto>.Fail(ex.Message));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
            }
        }

        // =====================================================================
        // GET /api/rounds/{roundId}/purse-summary
        // =====================================================================
        [HttpGet("api/rounds/{roundId:int}/purse-summary")]
        public async Task<ActionResult<ApiResponse<RoundPurseSummaryDto>>> GetRoundPurseSummary(int roundId)
        {
            var (userId, role) = GetIdentity();
            try
            {
                var result = await _payoutService.GetRoundPurseSummaryAsync(roundId, userId, role);
                return Ok(ApiResponse<RoundPurseSummaryDto>.Ok(result));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<RoundPurseSummaryDto>.Fail(ex.Message));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
            }
        }

        // =====================================================================
        // GET /api/races/{raceId}/purse-summary
        // =====================================================================
        [HttpGet("api/races/{raceId:int}/purse-summary")]
        public async Task<ActionResult<ApiResponse<RacePurseSummaryDto>>> GetRacePurseSummary(int raceId)
        {
            var (userId, role) = GetIdentity();
            try
            {
                var result = await _payoutService.GetRacePurseSummaryAsync(raceId, userId, role);
                return Ok(ApiResponse<RacePurseSummaryDto>.Ok(result));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<RacePurseSummaryDto>.Fail(ex.Message));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
            }
        }
    }
}
