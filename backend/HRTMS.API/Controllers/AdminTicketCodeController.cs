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

    /// <summary>
    /// Admin tạo batch mã vé thưởng (BR-63). Raw code chỉ trả về một lần trong response này —
    /// DB chỉ lưu SHA-256 hash, không có endpoint nào lấy lại raw code sau đó.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateBatch([FromBody] CreateTicketCodesDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _walletService.CreateTicketCodesAsync(CurrentAdminId, dto, ip);
        return result.Success ? Ok(result) : BadRequest(result);
    }
}
