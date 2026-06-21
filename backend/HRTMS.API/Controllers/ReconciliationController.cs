using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[ApiController]
[Route("api/reconciliation")]
[Authorize(Roles = "Spectator")]
public class ReconciliationController : ControllerBase
{
    private readonly IReconciliationService _reconciliationService;

    public ReconciliationController(IReconciliationService reconciliationService)
    {
        _reconciliationService = reconciliationService;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // UI-S35 — lịch sử dự đoán
    [HttpGet("predictions")]
    public async Task<IActionResult> GetMyPredictions()
    {
        var result = await _reconciliationService.GetMyPredictionsAsync(CurrentUserId);
        return Ok(result);
    }

    // UI-S34 — ví + lịch sử giao dịch
    [HttpGet("wallet")]
    public async Task<IActionResult> GetMyWallet()
    {
        var result = await _reconciliationService.GetMyWalletAsync(CurrentUserId);
        return result.Success ? Ok(result) : NotFound(result);
    }
}