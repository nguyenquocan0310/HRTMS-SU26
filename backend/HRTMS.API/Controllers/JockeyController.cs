using HRTMS.Core.DTOs.Jockey;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("jockey")]
[ApiController]
[Route("api/jockeys")]
[Authorize]
public class JockeyController : ControllerBase
{
    private readonly IJockeyService _jockeyService;

    public JockeyController(IJockeyService jockeyService)
    {
        _jockeyService = jockeyService;
    }

    [HttpGet("profile")]
    [Authorize(Roles = "Jockey")]
    public async Task<IActionResult> GetProfile()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var jockeyId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Invalid or missing user identity."
            });
        }

        var profile = await _jockeyService.GetProfileAsync(jockeyId);

        if (profile == null)
        {
            return NotFound(new
            {
                error = "JOCKEY_PROFILE_NOT_FOUND",
                message = "Jockey profile was not found."
            });
        }

        return Ok(profile);
    }

    [HttpPatch("profile")]
    [Authorize(Roles = "Jockey")]
    public async Task<IActionResult> UpdateProfile(
        [FromBody] UpdateJockeyProfileDto dto)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var jockeyId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Invalid or missing user identity."
            });
        }

        var profile = await _jockeyService.UpdateProfileAsync(
            jockeyId,
            dto);

        if (profile == null)
        {
            return NotFound(new
            {
                error = "JOCKEY_PROFILE_NOT_FOUND",
                message = "Jockey profile was not found."
            });
        }

        return Ok(new
        {
            jockeyId = profile.JockeyId,
            status = profile.Status,
            message = profile.Status == "Pending"
                ? "Jockey profile updated. License changed — awaiting Admin re-approval."
                : "Jockey profile updated successfully."
        });
    }

    [HttpGet("available")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> GetAvailableJockeys(
        [FromQuery] int tournamentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var ownerId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Invalid or missing user identity."
            });
        }

        if (tournamentId <= 0)
        {
            return BadRequest(new
            {
                error = "VALIDATION_ERROR",
                message = "TournamentId is required."
            });
        }

        try
        {
            var result = await _jockeyService.GetAvailableAsync(
                ownerId,
                tournamentId,
                page,
                pageSize);

            return Ok(result);
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "TOURNAMENT_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "TOURNAMENT_NOT_FOUND",
                message = "Tournament was not found."
            });
        }
    }

    [HttpGet("invitations")]
    [Authorize(Roles = "Jockey")]
    public async Task<IActionResult> GetInvitations(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var jockeyId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Invalid or missing user identity."
            });
        }

        try
        {
            var result = await _jockeyService.GetInvitationsAsync(
                jockeyId,
                status,
                page,
                pageSize);

            return Ok(result);
        }
        catch (ArgumentException ex)
            when (ex.Message == "INVALID_PAIRING_STATUS")
        {
            return BadRequest(new
            {
                error = "VALIDATION_ERROR",
                message = "Status must be Pending, Accepted, or Declined."
            });
        }
    }
    [HttpGet("race-entries/my")]
    [Authorize(Roles = "Jockey")]
    public async Task<IActionResult> GetMyRaceEntries(
    [FromQuery] string? status,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var jockeyId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Invalid or missing user identity."
            });
        }

        try
        {
            var result = await _jockeyService.GetMyRaceEntriesAsync(
                jockeyId,
                status,
                page,
                pageSize);

            return Ok(result);
        }
        catch (ArgumentException ex)
            when (ex.Message == "INVALID_RACE_ENTRY_STATUS")
        {
            return BadRequest(new
            {
                error = "VALIDATION_ERROR",
                message = "Status must be Pending, Confirmed, Cancelled, or Disqualified."
            });
        }
    }
    // Jockey tu xem career cua chinh minh (lay jockeyId tu JWT, khong nhan tu route)
    [HttpGet("stats/my")]
    [Authorize(Roles = "Jockey")]
    public async Task<IActionResult> GetMyCareerStats()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var jockeyId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Invalid or missing user identity."
            });
        }

        try
        {
            var result = await _jockeyService.GetCareerStatsAsync(jockeyId);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new
            {
                error = "JOCKEY_NOT_FOUND",
                message = "Jockey profile not found."
            });
        }
    }

    // Xem career cua 1 Jockey bat ky — Owner dung khi chon Jockey de ghep cap,
    // Admin/other roles cung xem duoc. Yeu cau da dang nhap (khong AllowAnonymous).
    [HttpGet("{jockeyId:int}/stats")]
    public async Task<IActionResult> GetJockeyCareerStats(int jockeyId)
    {
        try
        {
            var result = await _jockeyService.GetCareerStatsAsync(jockeyId);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new
            {
                error = "JOCKEY_NOT_FOUND",
                message = "Jockey profile not found."
            });
        }
    }
}