using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Purse;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;

namespace HRTMS.API.Controllers
{
    /// <summary>
    /// Module K — Owner tự xem tiền thưởng của mình (self-scoped).
    /// Tách khỏi <c>PursePayoutController</c> (Admin-only) vì đây là view cho Owner:
    /// id lấy từ JWT, KHÔNG nhận từ query → Owner chỉ thấy payout của chính mình.
    /// </summary>
    [Tags("results")]
    [ApiController]
    [Route("api/owner")]
    [Authorize(Roles = "Owner")]
    public class OwnerEarningsController : ControllerBase
    {
        private readonly IPursePayoutService _payoutService;

        public OwnerEarningsController(IPursePayoutService payoutService)
        {
            _payoutService = payoutService;
        }

        // userId LUÔN lấy từ claim — không nhận recipientUserId từ query (chống xem chéo).
        private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // =====================================================================
        // GET /api/owner/earnings
        // Tổng thưởng + chi tiết từng dòng (ngựa nào thắng, hạng mấy, bao nhiêu,
        // đã trả chưa). Chỉ race Official mới có payout.
        // =====================================================================
        [HttpGet("earnings")]
        [ProducesResponseType(typeof(ApiResponse<OwnerEarningsDto>), StatusCodes.Status200OK)]
        public async Task<ActionResult<ApiResponse<OwnerEarningsDto>>> GetMyEarnings()
        {
            var result = await _payoutService.GetMyEarningsAsync(CurrentUserId);
            return Ok(ApiResponse<OwnerEarningsDto>.Ok(result));
        }
    }
}
