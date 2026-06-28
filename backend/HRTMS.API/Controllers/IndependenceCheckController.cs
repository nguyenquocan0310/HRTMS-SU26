using System.Security.Claims;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

[Tags("referee")]
[ApiController]
[Route("api/referee/race-entries")]
[Authorize(Roles = "Referee")]
public class IndependenceCheckController : ControllerBase
{
    private readonly IIndependenceCheckService _independenceCheckService;

    public IndependenceCheckController(
        IIndependenceCheckService independenceCheckService)
    {
        _independenceCheckService = independenceCheckService;
    }

    [HttpPatch("{raceEntryId:int}/independence-check")]
    public async Task<IActionResult> CheckJockeyIndependence(
        int raceEntryId)
    {
        var refereeIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(refereeIdClaim, out var refereeId))
        {
            return Unauthorized(new
            {
                error = "INVALID_TOKEN",
                message = "Invalid referee token."
            });
        }

        try
        {
            // Referee kich hoat kiem tra tinh doc lap cua Jockey
            var result = await _independenceCheckService
                .CheckJockeyIndependenceAsync(refereeId, raceEntryId);

            return Ok(result);
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "REFEREE_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "REFEREE_NOT_FOUND",
                message = "Referee was not found."
            });
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "RACE_ENTRY_NOT_FOUND",
                message = "Race entry was not found."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "USER_NOT_REFEREE")
        {
            return UnprocessableEntity(new
            {
                error = "USER_NOT_REFEREE",
                message = "The current user is not a referee."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "REFEREE_NOT_ACTIVE")
        {
            return UnprocessableEntity(new
            {
                error = "REFEREE_NOT_ACTIVE",
                message = "The referee is not active."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "RACE_ENTRY_NOT_ELIGIBLE")
        {
            return Conflict(new
            {
                error = "RACE_ENTRY_NOT_ELIGIBLE",
                message = "Race entry is cancelled, withdrawn, or disqualified."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "RACE_NOT_UPCOMING")
        {
            return Conflict(new
            {
                error = "RACE_NOT_UPCOMING",
                message = "Independence check can only be performed before the race starts."
            });
        }
    }
}