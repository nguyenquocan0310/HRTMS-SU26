using HRTMS.Core.DTOs.Jockey;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

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
        // Lay JockeyId tu JWT token
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
        // Lay JockeyId tu JWT token
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
            message = "Jockey profile updated successfully."
        });
    }

    [HttpGet("available")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> GetAvailableJockeys(
        [FromQuery] int tournamentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        // Lay OwnerId tu JWT token
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
        // Lay JockeyId tu JWT token
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
}