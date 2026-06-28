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
    [Tags("results")]
    [ApiController]
    [Authorize(Roles = "Admin")]   // REQ-F-PRZ.6 — chỉ Admin quản lý chi trả
    public class PursePayoutController : ControllerBase
    {
        private readonly IPursePayoutService _payoutService;

        public PursePayoutController(IPursePayoutService payoutService)
        {
            _payoutService = payoutService;
        }

        // Lấy UserId từ JWT claim, không nhận từ body — cùng pattern ResultController/TournamentController
        private int GetCurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // =====================================================================
        // GET /api/races/{raceId}/payouts
        // REQ-F-PRZ.6 + PRZ.4 — Bảng phân bổ Purse + dòng Remainder của 1 cuộc đua (UI-S14)
        // =====================================================================
        [HttpGet("api/races/{raceId}/payouts")]
        public async Task<ActionResult<ApiResponse<RacePayoutSummaryDto>>> GetRacePayouts(int raceId)
        {
            try
            {
                var result = await _payoutService.GetRacePayoutsAsync(raceId);
                return Ok(ApiResponse<RacePayoutSummaryDto>.Ok(result));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<RacePayoutSummaryDto>.Fail(ex.Message));
            }
        }

        // =====================================================================
        // PUT /api/payouts/{payoutId}/status
        // REQ-F-PRZ.6 — Đánh dấu Paid/Unpaid (ghi AuditLog trong service)
        // =====================================================================
        [HttpPut("api/payouts/{payoutId}/status")]
        public async Task<ActionResult<ApiResponse<PursePayoutItemDto>>> UpdatePayoutStatus(
            int payoutId, [FromBody] MarkPayoutStatusDto dto)
        {
            try
            {
                var result = await _payoutService.UpdatePayoutStatusAsync(payoutId, dto, GetCurrentUserId());
                return Ok(ApiResponse<PursePayoutItemDto>.Ok(result, "Cập nhật trạng thái chi trả thành công"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<PursePayoutItemDto>.Fail(ex.Message));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<PursePayoutItemDto>.Fail(ex.Message));
            }
        }

        // =====================================================================
        // GET /api/payouts/earnings-history?recipientUserId=&role=
        // REQ-F-PRZ.6 — Lịch sử thưởng tích lũy cho Owner/Jockey
        // =====================================================================
        [HttpGet("api/payouts/earnings-history")]
        public async Task<ActionResult<ApiResponse<List<EarningsHistoryItemDto>>>> GetEarningsHistory(
            [FromQuery] int? recipientUserId, [FromQuery] string? role)
        {
            var result = await _payoutService.GetEarningsHistoryAsync(recipientUserId, role);
            return Ok(ApiResponse<List<EarningsHistoryItemDto>>.Ok(result));
        }
    }
}