using System.Security.Claims;
using HRTMS.Core.DTOs.Medical;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

[Tags("prerace")]
[ApiController]
[Route("api/doctor/race-entries")]
[Authorize(Roles = "Doctor")]
public class MedicalCheckController : ControllerBase
{
    private readonly IMedicalCheckService _medicalCheckService;

    public MedicalCheckController(
        IMedicalCheckService medicalCheckService)
    {
        _medicalCheckService = medicalCheckService;
    }

    [HttpPatch("{raceEntryId:int}/pre-race-weight")]
    public async Task<IActionResult> RecordPreRaceWeight(
        int raceEntryId,
        [FromBody] RecordPreRaceWeightDto dto)
    {
        var doctorIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(doctorIdClaim, out var doctorId))
            return Unauthorized(new { error = "INVALID_TOKEN", message = "Invalid doctor token." });

        try
        {
            var result = await _medicalCheckService.RecordPreRaceWeightAsync(doctorId, raceEntryId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "DOCTOR_NOT_FOUND")
        { return NotFound(new { error = "DOCTOR_NOT_FOUND", message = "Doctor was not found." }); }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        { return NotFound(new { error = "RACE_ENTRY_NOT_FOUND", message = "Race entry was not found." }); }
        catch (InvalidOperationException ex) when (ex.Message == "USER_NOT_DOCTOR")
        { return UnprocessableEntity(new { error = "USER_NOT_DOCTOR", message = "The current user is not a doctor." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ACTIVE")
        { return UnprocessableEntity(new { error = "DOCTOR_NOT_ACTIVE", message = "The doctor is not active." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ASSIGNED_TO_RACE")
        { return Forbid(); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ENTRY_NOT_ELIGIBLE")
        { return Conflict(new { error = "RACE_ENTRY_NOT_ELIGIBLE", message = "Race entry is cancelled, withdrawn, or disqualified." }); }
        catch (InvalidOperationException ex) when (ex.Message == "STARTING_LIST_ALREADY_CONFIRMED")
        { return Conflict(new { error = "STARTING_LIST_ALREADY_CONFIRMED", message = "Starting list has been confirmed; pre-race data can no longer be modified." }); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UPCOMING")
        { return Conflict(new { error = "RACE_NOT_UPCOMING", message = "Pre-race weight can only be recorded before the race starts." }); }
    }

    [HttpPatch("{raceEntryId:int}/post-race-weight")]
    public async Task<IActionResult> RecordPostRaceWeight(
        int raceEntryId,
        [FromBody] RecordPostRaceWeightDto dto)
    {
        var doctorIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(doctorIdClaim, out var doctorId))
            return Unauthorized(new { error = "INVALID_TOKEN", message = "Invalid doctor token." });

        try
        {
            var result = await _medicalCheckService.RecordPostRaceWeightAsync(doctorId, raceEntryId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "DOCTOR_NOT_FOUND")
        { return NotFound(new { error = "DOCTOR_NOT_FOUND", message = "Doctor was not found." }); }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        { return NotFound(new { error = "RACE_ENTRY_NOT_FOUND", message = "Race entry was not found." }); }
        catch (InvalidOperationException ex) when (ex.Message == "USER_NOT_DOCTOR")
        { return UnprocessableEntity(new { error = "USER_NOT_DOCTOR", message = "The current user is not a doctor." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ACTIVE")
        { return UnprocessableEntity(new { error = "DOCTOR_NOT_ACTIVE", message = "The doctor is not active." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ASSIGNED_TO_RACE")
        { return Forbid(); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ENTRY_NOT_ELIGIBLE")
        { return Conflict(new { error = "RACE_ENTRY_NOT_ELIGIBLE", message = "Race entry is cancelled, withdrawn, or disqualified." }); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UNOFFICIAL")
        { return Conflict(new { error = "RACE_NOT_UNOFFICIAL", message = "Post-race weight can only be recorded after the referee has submitted finish results (race is Unofficial)." }); }
        catch (InvalidOperationException ex) when (ex.Message == "PRE_RACE_WEIGHT_REQUIRED")
        { return Conflict(new { error = "PRE_RACE_WEIGHT_REQUIRED", message = "Pre-race weight must exist before recording weigh-out." }); }
    }

    [HttpPatch("{raceEntryId:int}/horse-identity")]
    public async Task<IActionResult> RecordHorseIdentity(
        int raceEntryId,
        [FromBody] RecordHorseIdentityDto dto)
    {
        var doctorIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(doctorIdClaim, out var doctorId))
            return Unauthorized(new { error = "INVALID_TOKEN", message = "Invalid doctor token." });

        try
        {
            var result = await _medicalCheckService.RecordHorseIdentityAsync(doctorId, raceEntryId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "DOCTOR_NOT_FOUND")
        { return NotFound(new { error = "DOCTOR_NOT_FOUND", message = "Doctor was not found." }); }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        { return NotFound(new { error = "RACE_ENTRY_NOT_FOUND", message = "Race entry was not found." }); }
        catch (InvalidOperationException ex) when (ex.Message == "USER_NOT_DOCTOR")
        { return UnprocessableEntity(new { error = "USER_NOT_DOCTOR", message = "The current user is not a doctor." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ACTIVE")
        { return UnprocessableEntity(new { error = "DOCTOR_NOT_ACTIVE", message = "The doctor is not active." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ASSIGNED_TO_RACE")
        { return Forbid(); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ENTRY_NOT_ELIGIBLE")
        { return Conflict(new { error = "RACE_ENTRY_NOT_ELIGIBLE", message = "Race entry is cancelled, withdrawn, or disqualified." }); }
        catch (InvalidOperationException ex) when (ex.Message == "STARTING_LIST_ALREADY_CONFIRMED")
        { return Conflict(new { error = "STARTING_LIST_ALREADY_CONFIRMED", message = "Starting list has been confirmed; pre-race data can no longer be modified." }); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UPCOMING")
        { return Conflict(new { error = "RACE_NOT_UPCOMING", message = "Horse identity can only be checked before the race starts." }); }
    }

    [HttpPatch("{raceEntryId:int}/clinical-check")]
    public async Task<IActionResult> RecordClinicalCheck(
        int raceEntryId,
        [FromBody] RecordClinicalCheckDto dto)
    {
        var doctorIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(doctorIdClaim, out var doctorId))
            return Unauthorized(new { error = "INVALID_TOKEN", message = "Invalid doctor token." });

        try
        {
            var result = await _medicalCheckService.RecordClinicalCheckAsync(doctorId, raceEntryId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "DOCTOR_NOT_FOUND")
        { return NotFound(new { error = "DOCTOR_NOT_FOUND", message = "Doctor was not found." }); }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        { return NotFound(new { error = "RACE_ENTRY_NOT_FOUND", message = "Race entry was not found." }); }
        catch (InvalidOperationException ex) when (ex.Message == "USER_NOT_DOCTOR")
        { return UnprocessableEntity(new { error = "USER_NOT_DOCTOR", message = "The current user is not a doctor." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ACTIVE")
        { return UnprocessableEntity(new { error = "DOCTOR_NOT_ACTIVE", message = "The doctor is not active." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ASSIGNED_TO_RACE")
        { return Forbid(); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ENTRY_NOT_ELIGIBLE")
        { return Conflict(new { error = "RACE_ENTRY_NOT_ELIGIBLE", message = "Race entry is cancelled, withdrawn, or disqualified." }); }
        catch (InvalidOperationException ex) when (ex.Message == "STARTING_LIST_ALREADY_CONFIRMED")
        { return Conflict(new { error = "STARTING_LIST_ALREADY_CONFIRMED", message = "Starting list has been confirmed; pre-race data can no longer be modified." }); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UPCOMING")
        { return Conflict(new { error = "RACE_NOT_UPCOMING", message = "Clinical check can only be recorded before the race starts." }); }
        catch (InvalidOperationException ex) when (ex.Message == "UNFIT_REASON_REQUIRED")
        { return BadRequest(new { error = "UNFIT_REASON_REQUIRED", message = "Unfit reason is required when clinical status is Unfit." }); }
        catch (InvalidOperationException ex) when (ex.Message == "UNFIT_REASON_TOO_SHORT")
        { return BadRequest(new { error = "UNFIT_REASON_TOO_SHORT", message = "Unfit reason must be at least 20 characters." }); }
    }
    // Doctor kham lam sang lai cho CA ngua + nai SAU khi tran ket thuc (Race
    // o trang thai Unofficial). Buoc bat buoc truoc khi Admin Declare Official.
    [HttpPatch("{raceEntryId:int}/post-race-clinical-check")]
    public async Task<IActionResult> RecordPostRaceClinicalCheck(
        int raceEntryId,
        [FromBody] RecordPostRaceClinicalCheckDto dto)
    {
        var doctorIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(doctorIdClaim, out var doctorId))
            return Unauthorized(new { error = "INVALID_TOKEN", message = "Invalid doctor token." });

        try
        {
            var result = await _medicalCheckService.RecordPostRaceClinicalCheckAsync(doctorId, raceEntryId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "DOCTOR_NOT_FOUND")
        { return NotFound(new { error = "DOCTOR_NOT_FOUND", message = "Doctor was not found." }); }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        { return NotFound(new { error = "RACE_ENTRY_NOT_FOUND", message = "Race entry was not found." }); }
        catch (InvalidOperationException ex) when (ex.Message == "USER_NOT_DOCTOR")
        { return UnprocessableEntity(new { error = "USER_NOT_DOCTOR", message = "The current user is not a doctor." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ACTIVE")
        { return UnprocessableEntity(new { error = "DOCTOR_NOT_ACTIVE", message = "The doctor is not active." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ASSIGNED_TO_RACE")
        { return Forbid(); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ENTRY_NOT_ELIGIBLE")
        { return Conflict(new { error = "RACE_ENTRY_NOT_ELIGIBLE", message = "Race entry is cancelled, withdrawn, or disqualified." }); }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UNOFFICIAL")
        { return Conflict(new { error = "RACE_NOT_UNOFFICIAL", message = "Post-race clinical check can only be recorded after the referee has submitted finish results (race is Unofficial)." }); }
        catch (InvalidOperationException ex) when (ex.Message == "UNFIT_REASON_REQUIRED")
        { return BadRequest(new { error = "UNFIT_REASON_REQUIRED", message = "Unfit reason is required when post-race clinical status is Unfit." }); }
        catch (InvalidOperationException ex) when (ex.Message == "UNFIT_REASON_TOO_SHORT")
        { return BadRequest(new { error = "UNFIT_REASON_TOO_SHORT", message = "Unfit reason must be at least 20 characters." }); }
    }

    [HttpGet("races/{raceId}/entries")]
    public async Task<IActionResult> GetRaceEntries(int raceId)
    {
        var doctorId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var result = await _medicalCheckService.GetRaceEntriesAsync(
            doctorId,
            raceId);

        return Ok(result);
    }
    [HttpGet("{raceEntryId:int}/health-profile")]
    public async Task<IActionResult> GetRaceEntryHealthProfile(int raceEntryId)
    {
        var doctorIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(doctorIdClaim, out var doctorId))
            return Unauthorized(new { error = "INVALID_TOKEN", message = "Invalid doctor token." });

        try
        {
            var result = await _medicalCheckService.GetRaceEntryHealthProfileAsync(doctorId, raceEntryId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "DOCTOR_NOT_FOUND")
        { return NotFound(new { error = "DOCTOR_NOT_FOUND", message = "Doctor was not found." }); }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        { return NotFound(new { error = "RACE_ENTRY_NOT_FOUND", message = "Race entry was not found." }); }
        catch (InvalidOperationException ex) when (ex.Message == "USER_NOT_DOCTOR")
        { return UnprocessableEntity(new { error = "USER_NOT_DOCTOR", message = "The current user is not a doctor." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ACTIVE")
        { return UnprocessableEntity(new { error = "DOCTOR_NOT_ACTIVE", message = "The doctor is not active." }); }
        catch (InvalidOperationException ex) when (ex.Message == "DOCTOR_NOT_ASSIGNED_TO_RACE")
        { return Forbid(); }
    }
}
