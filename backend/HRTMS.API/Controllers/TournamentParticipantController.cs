using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Participant;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class TournamentParticipantController : ControllerBase
{
    private readonly ITournamentParticipantService _service;

    public TournamentParticipantController(ITournamentParticipantService service)
    {
        _service = service;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private string CurrentRole =>
        User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    /// <summary>Owner/Jockey/Doctor/Referee tự đăng ký tham gia một giải → Pending.</summary>
    [HttpPost("tournament/{tournamentId:int}/participants")]
    [Authorize(Roles = "Owner,Jockey,Doctor,Referee")]
    [ProducesResponseType(typeof(ApiResponse<ParticipantResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(int tournamentId)
    {
        var result = await _service.RegisterAsync(CurrentUserId, CurrentRole, tournamentId);
        if (!result.Success)
            return result.Message.Contains("NOT_FOUND") ? NotFound(result) : BadRequest(result);
        return Ok(result);
    }

    /// <summary>Admin xem roster của giải (lọc tuỳ chọn theo role/status).</summary>
    [HttpGet("tournament/{tournamentId:int}/participants")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<List<ParticipantResponseDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRoster(
        int tournamentId,
        [FromQuery] string? role,
        [FromQuery] string? status)
    {
        var result = await _service.GetRosterAsync(tournamentId, role, status);
        return Ok(result);
    }

    /// <summary>Người dùng xem các giải mình đã đăng ký.</summary>
    [HttpGet("my/tournament-participations")]
    [ProducesResponseType(typeof(ApiResponse<List<ParticipantResponseDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyParticipations()
    {
        var result = await _service.GetMyParticipationsAsync(CurrentUserId);
        return Ok(result);
    }

    /// <summary>Admin duyệt một đăng ký tham gia giải.</summary>
    [HttpPatch("admin/tournament-participants/{participantId:int}/approve")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<ParticipantResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Approve(int participantId)
    {
        var result = await _service.ApproveAsync(CurrentUserId, participantId);
        if (!result.Success)
            return result.Message.Contains("NOT_FOUND") ? NotFound(result) : BadRequest(result);
        return Ok(result);
    }

    /// <summary>Admin từ chối một đăng ký tham gia giải (kèm lý do ≥10 ký tự).</summary>
    [HttpPatch("admin/tournament-participants/{participantId:int}/reject")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<ParticipantResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Reject(int participantId, [FromBody] RejectParticipantDto dto)
    {
        var result = await _service.RejectAsync(CurrentUserId, participantId, dto.Reason);
        if (!result.Success)
            return result.Message.Contains("NOT_FOUND") ? NotFound(result) : BadRequest(result);
        return Ok(result);
    }
}
