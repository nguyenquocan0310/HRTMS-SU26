using HRTMS.Core.DTOs.Jockey;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[ApiController]
[Route("api/jockeys")]
[Authorize(Roles = "Jockey")]
public class JockeyController : ControllerBase
{
    private readonly IJockeyService _jockeyService;

    public JockeyController(IJockeyService jockeyService)
    {
        _jockeyService = jockeyService;
    }

    [HttpGet("profile")]
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
}