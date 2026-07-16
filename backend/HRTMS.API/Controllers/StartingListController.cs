using System.Security.Claims;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

[Tags("scheduling")]
[ApiController]
[Route("api/referee/races")]
[Authorize(Roles = "Referee")]
public class StartingListController : ControllerBase
{
    private readonly IStartingListService _startingListService;

    public StartingListController(
        IStartingListService startingListService)
    {
        _startingListService = startingListService;
    }

    // GET /api/referee/race-entries/races/{raceId}/entries
    // Preview read-only. Referee phai Active va duoc assign vao race.
    [HttpGet("/api/referee/race-entries/races/{raceId:int}/entries")]
    public async Task<IActionResult> GetRaceEntries(int raceId)
    {
        var refereeIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(refereeIdClaim, out var refereeId))
        {
            return Unauthorized(new { error = "INVALID_TOKEN", message = "Invalid referee token." });
        }

        try
        {
            var result = await _startingListService.GetRaceEntriesAsync(refereeId, raceId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "REFEREE_NOT_FOUND")
        { return NotFound(new { error = "REFEREE_NOT_FOUND", message = "Referee was not found." }); }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        { return NotFound(new { error = "RACE_NOT_FOUND", message = "Race was not found." }); }
        catch (InvalidOperationException ex) when (ex.Message == "USER_NOT_REFEREE")
        { return UnprocessableEntity(new { error = "USER_NOT_REFEREE", message = "The current user is not a referee." }); }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ACTIVE")
        { return UnprocessableEntity(new { error = "REFEREE_NOT_ACTIVE", message = "The referee is not active." }); }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        { return Forbid(); }
    }

    [HttpPost("{raceId:int}/confirm-starting-list")]
    public async Task<IActionResult> ConfirmStartingList(int raceId)
    {
        var refereeIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(refereeIdClaim, out var refereeId))
        {
            return Unauthorized(new { error = "INVALID_TOKEN", message = "Invalid referee token." });
        }

        try
        {
            var result = await _startingListService.ConfirmStartingListAsync(refereeId, raceId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "REFEREE_NOT_FOUND")
        { return NotFound(new { error = "REFEREE_NOT_FOUND", message = "Referee was not found." }); }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        { return NotFound(new { error = "RACE_NOT_FOUND", message = "Race was not found." }); }
        catch (InvalidOperationException ex) when (ex.Message == "USER_NOT_REFEREE")
        { return UnprocessableEntity(new { error = "USER_NOT_REFEREE", message = "The current user is not a referee." }); }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ACTIVE")
        { return UnprocessableEntity(new { error = "REFEREE_NOT_ACTIVE", message = "The referee is not active." }); }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        { return Forbid(); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UPCOMING")
        { return Conflict(new { error = "RACE_NOT_UPCOMING", message = "Starting list can only be confirmed before the race starts." }); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_DRAWN")
        { return Conflict(new { error = "RACE_NOT_DRAWN", message = "Post positions must be drawn before confirming the starting list." }); }
        catch (InvalidOperationException ex) when (ex.Message == "NO_RACE_ENTRIES")
        { return Conflict(new { error = "NO_RACE_ENTRIES", message = "Race has no race entries." }); }
        catch (InvalidOperationException ex) when (ex.Message == "NO_ELIGIBLE_STARTING_ENTRIES")
        { return Conflict(new { error = "NO_ELIGIBLE_STARTING_ENTRIES", message = "There are no eligible race entries for the official starting list." }); }
    }
}
