using HRTMS.Core.DTOs.Doctor;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

[Tags("prerace")]
[ApiController]
[Route("api/admin/races/{raceId:int}/doctors")]
[Authorize(Roles = "Admin")]
public class DoctorAssignmentController : ControllerBase
{
    private readonly IDoctorAssignmentService _doctorAssignmentService;

    public DoctorAssignmentController(
        IDoctorAssignmentService doctorAssignmentService)
    {
        _doctorAssignmentService = doctorAssignmentService;
    }

    [HttpPost]
    public async Task<IActionResult> AssignDoctor(
        int raceId,
        [FromBody] AssignDoctorDto dto)
    {
        try
        {
            // Admin gan Doctor vao Race
            var result = await _doctorAssignmentService.AssignAsync(
                raceId,
                dto);

            return Created(
                $"/api/admin/races/{raceId}/doctors/{result.DoctorId}",
                result);
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "RACE_NOT_FOUND",
                message = "Race was not found."
            });
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "DOCTOR_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "DOCTOR_NOT_FOUND",
                message = "Doctor was not found."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "USER_NOT_DOCTOR")
        {
            return UnprocessableEntity(new
            {
                error = "USER_NOT_DOCTOR",
                message = "The selected user is not a doctor."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "DOCTOR_NOT_ACTIVE")
        {
            return UnprocessableEntity(new
            {
                error = "DOCTOR_NOT_ACTIVE",
                message = "The doctor is not active."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "DOCTOR_ALREADY_ASSIGNED")
        {
            return Conflict(new
            {
                error = "DOCTOR_ALREADY_ASSIGNED",
                message = "This doctor is already assigned to this race."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "DOCTOR_DOUBLE_BOOKED")
        {
            return Conflict(new
            {
                error = "DOCTOR_DOUBLE_BOOKED",
                message = "This doctor is already assigned to another race at the same time."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "DOCTOR_CONFLICT_OF_INTEREST")
        {
            return Conflict(new
            {
                error = "DOCTOR_CONFLICT_OF_INTEREST",
                message = "This doctor has a conflict of interest with an owner in this race."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "DOCTOR_NOT_IN_TOURNAMENT_ROSTER")
        {
            // Doctor chua dang ky / chua duoc duyet tham gia giai chua Race nay
            return UnprocessableEntity(new
            {
                error = "DOCTOR_NOT_IN_TOURNAMENT_ROSTER",
                message = "This doctor is not an approved participant of this tournament."
            });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetDoctorsByRace(
        int raceId)
    {
        try
        {
            // Lay danh sach Doctor da duoc gan vao Race
            var result = await _doctorAssignmentService.GetByRaceAsync(
                raceId);

            return Ok(result);
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "RACE_NOT_FOUND",
                message = "Race was not found."
            });
        }
    }

    [HttpDelete("{doctorId:int}")]
    public async Task<IActionResult> RemoveDoctor(
        int raceId,
        int doctorId)
    {
        try
        {
            // Go Doctor khoi Race
            await _doctorAssignmentService.RemoveAsync(
                raceId,
                doctorId);

            return NoContent();
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "DOCTOR_ASSIGNMENT_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "DOCTOR_ASSIGNMENT_NOT_FOUND",
                message = "Doctor assignment was not found."
            });
        }
    }
}