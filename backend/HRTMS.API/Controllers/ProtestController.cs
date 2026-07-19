using System.Security.Claims;
using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Protest;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

[Tags("race")]
[ApiController]
[Route("api/protests")]
[Authorize]
public class ProtestController : ControllerBase
{
    private readonly IProtestService _protestService;

    public ProtestController(IProtestService protestService)
    {
        _protestService = protestService;
    }

    private bool TryGetUserId(out int userId) =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);

    [HttpPost]
    [Authorize(Roles = "Owner,Jockey")]
    [ProducesResponseType(typeof(ApiResponse<ProtestDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Submit([FromBody] SubmitProtestDto dto)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<ProtestDto>.Fail("Invalid session."));

        try
        {
            var protest = await _protestService.SubmitAsync(userId, dto);
            return CreatedAtAction(nameof(GetByRace), new { raceId = protest.RaceId },
                ApiResponse<ProtestDto>.Ok(protest, "Protest submitted."));
        }
        catch (KeyNotFoundException ex) when (ex.Message is "RACE_NOT_FOUND" or "ACCUSED_ENTRY_NOT_IN_RACE" or "VIOLATION_NOT_IN_RACE")
        {
            return NotFound(ApiResponse<ProtestDto>.Fail("Race, accused entry, or violation was not found."));
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<ProtestDto>.Fail("Only the Owner or Jockey of a confirmed race entry may submit a protest."));
        }
        catch (InvalidOperationException ex) when (ex.Message is "RACE_NOT_UNOFFICIAL" or "RACE_REPORT_LOCKED" or "PROTEST_WINDOW_CLOSED" or "PROTEST_LIMIT_REACHED")
        {
            return Conflict(ApiResponse<ProtestDto>.Fail(MapSubmissionError(ex.Message)));
        }
    }

    [HttpGet("races/{raceId:int}")]
    public async Task<IActionResult> GetByRace(int raceId)
    {
        try
        {
            var protests = await _protestService.GetByRaceAsync(raceId);
            return Ok(ApiResponse<IReadOnlyList<ProtestDto>>.Ok(protests));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<IReadOnlyList<ProtestDto>>.Fail("Race was not found."));
        }
    }

    [HttpPatch("{protestId:int}/ruling")]
    [Authorize(Roles = "Referee")]
    [ProducesResponseType(typeof(ApiResponse<ProtestRulingResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Rule(int protestId, [FromBody] RuleProtestDto dto)
    {
        if (!TryGetUserId(out var refereeId))
            return Unauthorized(ApiResponse<ProtestRulingResultDto>.Fail("Invalid session."));

        try
        {
            var result = await _protestService.RuleAsync(refereeId, protestId, dto);
            return Ok(ApiResponse<ProtestRulingResultDto>.Ok(result, "Protest ruling recorded."));
        }
        catch (KeyNotFoundException ex) when (ex.Message is "PROTEST_NOT_FOUND" or "PLACE_BEHIND_ENTRY_NOT_FOUND")
        {
            return NotFound(ApiResponse<ProtestRulingResultDto>.Fail("Protest or referenced race entry was not found."));
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<ProtestRulingResultDto>.Fail("Referee is not assigned to this race."));
        }
        catch (InvalidOperationException ex) when (ex.Message is "RACE_NOT_UNOFFICIAL" or "RACE_REPORT_LOCKED" or "PROTEST_ALREADY_RESOLVED")
        {
            return Conflict(ApiResponse<ProtestRulingResultDto>.Fail(MapRulingError(ex.Message)));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<ProtestRulingResultDto>.Fail(MapRulingError(ex.Message)));
        }
    }

    // Referee can manually close the protest window early (min 5 minutes after
    // the preliminary result was submitted) instead of waiting the full
    // Race.ProtestDeadlineMinutes, so the race can move to Official sooner.
    [HttpPost("races/{raceId:int}/close-window")]
    [Authorize(Roles = "Referee")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CloseWindow(int raceId)
    {
        if (!TryGetUserId(out var refereeId))
            return Unauthorized(ApiResponse<object>.Fail("Invalid session."));

        try
        {
            await _protestService.CloseWindowEarlyAsync(raceId, refereeId);
            return Ok(ApiResponse<object>.Ok(null!, "Protest window closed."));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail("Race was not found."));
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<object>.Fail("Referee is not assigned to this race."));
        }
        catch (InvalidOperationException ex) when (ex.Message is "RACE_NOT_UNOFFICIAL" or "RACE_REPORT_LOCKED")
        {
            return Conflict(ApiResponse<object>.Fail("The race is not in a state where the protest window can be closed."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "MIN_WINDOW_NOT_ELAPSED")
        {
            return Conflict(ApiResponse<object>.Fail("The protest window can only be closed after at least 5 minutes."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PROTEST_WINDOW_ALREADY_CLOSED")
        {
            return Conflict(ApiResponse<object>.Fail("The protest window is already closed."));
        }
    }

    private static string MapSubmissionError(string code) => code switch
    {
        "RACE_NOT_UNOFFICIAL" => "Protests are only accepted while the race is Unofficial.",
        "RACE_REPORT_LOCKED" => "The race report is locked.",
        "PROTEST_WINDOW_CLOSED" => "The protest deadline has passed.",
        "PROTEST_LIMIT_REACHED" => "The maximum number of protests for this race has been reached.",
        _ => "The protest cannot be submitted."
    };

    private static string MapRulingError(string code) => code switch
    {
        "RACE_NOT_UNOFFICIAL" => "Only an Unofficial race may receive a protest ruling.",
        "RACE_REPORT_LOCKED" => "The race report is locked.",
        "PROTEST_ALREADY_RESOLVED" => "This protest has already been ruled.",
        "PENALTY_REQUIRED" => "An approved protest requires a penalty.",
        "PENALTY_NOT_ALLOWED" => "A rejected protest cannot have a penalty.",
        "PLACE_BEHIND_ENTRY_REQUIRED" => "PlaceBehind requires a target race entry.",
        "PLACE_BEHIND_ENTRY_SAME_AS_ACCUSED" => "The accused entry cannot be its own PlaceBehind target.",
        "INVALID_PENALTY" => "The penalty is invalid.",
        _ => "The protest ruling is invalid."
    };
}