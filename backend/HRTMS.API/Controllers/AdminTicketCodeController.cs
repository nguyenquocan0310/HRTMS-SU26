using HRTMS.Core.DTOs.Wallet;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("admin")]
[ApiController]
[Route("api/admin/ticket-codes")]
[Authorize(Roles = "Admin")]
public class AdminTicketCodeController : ControllerBase
{
    private readonly IWalletService _walletService;

    public AdminTicketCodeController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    private int CurrentAdminId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Admin tạo batch mã vé thưởng (BR-63). Trả về danh sách mã vừa sinh.</summary>
    [HttpPost]
    public async Task<IActionResult> CreateBatch([FromBody] CreateTicketCodesDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _walletService.CreateTicketCodesAsync(CurrentAdminId, dto, ip);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// Admin xem danh sách mã vé thưởng đã tạo (phân trang + lọc trạng thái).
    /// status: Active | Redeemed | Expired (bỏ trống = tất cả).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetCodes(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _walletService.GetTicketCodesAsync(status, page, pageSize);
        return result.Success ? Ok(result) : BadRequest(result);
    }
}
