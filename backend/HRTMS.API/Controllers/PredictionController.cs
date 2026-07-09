using HRTMS.Core.DTOs.Prediction;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("leaderboard")]
[ApiController]
[Route("api/predictions")]
[Authorize]
public class PredictionController : ControllerBase
{
    private readonly IPredictionService _predictionService;

    public PredictionController(IPredictionService predictionService)
    {
        _predictionService = predictionService;
    }

    // Admin cấu hình / đóng-mở cổng dự đoán
    [HttpPut("races/{raceId:int}/gate")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> SetGate(int raceId, [FromBody] PredictionGateConfigDto dto)
    {
        var adminId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _predictionService.SetPredictionGateAsync(raceId, dto, adminId, ip);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    // Trạng thái cổng — UI-S33 gọi trước khi cho Spectator đặt dự đoán
    [HttpGet("races/{raceId:int}/gate-status")]
    public async Task<IActionResult> GetGateStatus(int raceId)
    {
        var result = await _predictionService.GetGateStatusAsync(raceId);
        return result.Success ? Ok(result) : NotFound(result);
    }

    // Form Score (UI-S32, UI-S33)
    [HttpGet("races/{raceId:int}/form-scores")]
    public async Task<IActionResult> GetFormScores(int raceId)
    {
        var result = await _predictionService.GetFormScoresAsync(raceId);
        return result.Success ? Ok(result) : NotFound(result);
    }

    // Spectator đặt dự đoán Win
    [HttpPost]
    [Authorize(Roles = "Spectator")]
    public async Task<IActionResult> PlacePrediction([FromBody] PlacePredictionDto dto)
    {
        var spectatorId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _predictionService.PlacePredictionAsync(spectatorId, dto, ip);
        return result.Success ? Ok(result) : BadRequest(result);
    }
}