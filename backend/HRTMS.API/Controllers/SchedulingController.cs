using HRTMS.Core.DTOs.RaceEntry;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

// Module E — Lap lich, Boc tham & Rut lui (REQ-F-SCH).
// Tach rieng khoi RaceEntryController (von phuc vu Owner dang ky entry + entry fee).
[ApiController]
[Route("api")]
public class SchedulingController : ControllerBase
{
    private readonly IRaceEntryService _service;

    public SchedulingController(IRaceEntryService service)
    {
        _service = service;
    }

    // SCH.1 — Admin phan bo Pairing vao Race.
    [HttpPost("admin/races/{raceId:int}/entries")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Allocate(int raceId, [FromBody] AllocateEntryDto dto)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.AllocateAsync(adminId, raceId, dto);
            // Lich cong khai xem qua GET /api/races/{raceId}/entries (TournamentController - Module B).
            return Created($"/api/races/{raceId}/entries", result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(Err("RACE_NOT_FOUND", "Race was not found."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "PAIRING_NOT_FOUND")
        {
            return NotFound(Err("PAIRING_NOT_FOUND", "Pairing was not found."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ALREADY_DRAWN")
        {
            return Conflict(Err("RACE_ALREADY_DRAWN", "Post positions already drawn; cannot add entries."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "INVALID_RACE_STATE")
        {
            return UnprocessableEntity(Err("INVALID_RACE_STATE", "Race is not in a state that allows allocation."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PAIRING_NOT_CONFIRMED")
        {
            return UnprocessableEntity(Err("PAIRING_NOT_CONFIRMED", "Only accepted pairings can be allocated."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "HORSE_NOT_APPROVED")
        {
            return UnprocessableEntity(Err("HORSE_NOT_APPROVED", "The horse has not been approved."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "JOCKEY_EXPERIENCE_TOO_LOW")
        {
            return UnprocessableEntity(Err("JOCKEY_EXPERIENCE_TOO_LOW",
                "The jockey does not meet the tournament's minimum experience requirement."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "MAX_HORSES_REACHED")
        {
            return Conflict(Err("MAX_HORSES_REACHED", "The race already reached the maximum number of horses."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "DUPLICATE_IN_RACE")
        {
            return Conflict(Err("DUPLICATE_IN_RACE", "This horse or jockey is already entered in this race."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "DOUBLE_BOOKED")
        {
            return Conflict(Err("DOUBLE_BOOKED", "This horse or jockey is booked in another race at the same time."));
        }
        catch (InvalidOperationException ex) when (ex.Message is "RACE_IN_PAST" or "RACE_OUT_OF_WINDOW" or "RACE_BEFORE_ROUND")
        {
            return UnprocessableEntity(Err("INVALID_SCHEDULE", "Race schedule is outside the valid window."));
        }
    }

    // SCH.2 — Admin boc tham vi tri xuat phat (nguyen tu).
    [HttpPost("admin/races/{raceId:int}/draw")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Draw(int raceId)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.DrawPostPositionsAsync(adminId, raceId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(Err("RACE_NOT_FOUND", "Race was not found."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "ALREADY_DRAWN")
        {
            return Conflict(Err("ALREADY_DRAWN", "Post positions have already been drawn for this race."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "NO_ELIGIBLE_ENTRIES")
        {
            return UnprocessableEntity(Err("NO_ELIGIBLE_ENTRIES", "There are no eligible entries to draw."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "DRAW_CONFLICT")
        {
            return Conflict(Err("DRAW_CONFLICT", "A concurrent draw conflict occurred. Please retry."));
        }
    }

    // SCH.3 — Lich thi dau cong khai da co san: GET /api/races/{raceId}/entries
    // (TournamentController - Module B). Service van expose GetRaceScheduleAsync de tai su dung neu can.

    // SCH.4 — Owner xac nhan tham gia.
    [HttpPatch("race-entries/{id:int}/confirm")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> Confirm(int id)
    {
        if (!TryGetUserId(out var ownerId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.ConfirmAsync(ownerId, id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "ENTRY_NOT_FOUND")
        {
            return NotFound(Err("ENTRY_NOT_FOUND", "Race entry was not found."));
        }
        catch (UnauthorizedAccessException ex) when (ex.Message == "FORBIDDEN")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                Err("FORBIDDEN", "You are not allowed to confirm this entry."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "INVALID_STATUS")
        {
            return Conflict(Err("INVALID_STATUS", "Only pending entries can be confirmed."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "CONFIRMATION_CLOSED")
        {
            return UnprocessableEntity(Err("CONFIRMATION_CLOSED", "The confirmation cut-off time has passed."));
        }
    }

    // SCH.5 — Owner rut lui (Withdrawal Flow, idempotent).
    // DELETE theo contract; ly do (tuy chon) truyen qua query: ?reason=...
    [HttpDelete("race-entries/{id:int}")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> Withdraw(int id, [FromQuery] string? reason)
    {
        if (!TryGetUserId(out var ownerId))
            return UnauthorizedResult();

        try
        {
            var dto = new WithdrawEntryDto { Reason = reason };
            var result = await _service.WithdrawAsync(ownerId, id, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "ENTRY_NOT_FOUND")
        {
            return NotFound(Err("ENTRY_NOT_FOUND", "Race entry was not found."));
        }
        catch (UnauthorizedAccessException ex) when (ex.Message == "FORBIDDEN")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                Err("FORBIDDEN", "You are not allowed to withdraw this entry."));
        }
    }

    // ---------------- helpers ----------------

    private bool TryGetUserId(out int userId)
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out userId);
    }

    private IActionResult UnauthorizedResult() =>
        Unauthorized(Err("UNAUTHORIZED", "Invalid or missing user identity."));

    private static object Err(string error, string message) => new { error, message };
}
