using HRTMS.Core.DTOs.Wallet;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("leaderboard")]
[ApiController]
[Route("api/wallet")]
[Authorize(Roles = "Spectator")]
public class WalletController : ControllerBase
{
    private readonly IWalletService _walletService;

    public WalletController(IWalletService walletService)
    {
        _walletService = walletService;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Spectator redeem mã vé thưởng để cộng điểm ảo (BR-63 / REQ-F-PRD.5).</summary>
    [HttpPost("ticket-codes/redeem")]
    public async Task<IActionResult> RedeemTicketCode([FromBody] RedeemTicketCodeDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _walletService.RedeemTicketCodeAsync(CurrentUserId, dto, ip);
        return result.Success ? Ok(result) : BadRequest(result);
    }
}
