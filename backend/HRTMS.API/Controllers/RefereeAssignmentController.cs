using HRTMS.Core.DTOs.Referee;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

[ApiController]
[Route("api/admin/races/{raceId:int}/referees")]
[Authorize(Roles = "Admin")]
public class RefereeAssignmentController : ControllerBase
{
    private readonly IRefereeAssignmentService _refereeAssignmentService;

    public RefereeAssignmentController(
        IRefereeAssignmentService refereeAssignmentService)
    {
        _refereeAssignmentService = refereeAssignmentService;
    }

    [HttpPost]
    public async Task<IActionResult> AssignReferee(
        int raceId,
        [FromBody] AssignRefereeDto dto)
    {
        try
        {
            // Admin gan Referee vao Race
            var result = await _refereeAssignmentService.AssignAsync(
                raceId,
                dto);

            return Created(
                $"/api/admin/races/{raceId}/referees/{result.RefereeId}",
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
            when (ex.Message == "REFEREE_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "REFEREE_NOT_FOUND",
                message = "Referee was not found."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "USER_NOT_REFEREE")
        {
            return UnprocessableEntity(new
            {
                error = "USER_NOT_REFEREE",
                message = "The selected user is not a referee."
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
            when (ex.Message == "REFEREE_ALREADY_ASSIGNED")
        {
            return Conflict(new
            {
                error = "REFEREE_ALREADY_ASSIGNED",
                message = "This referee is already assigned to this race."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "LEAD_REFEREE_ALREADY_EXISTS")
        {
            return Conflict(new
            {
                error = "LEAD_REFEREE_ALREADY_EXISTS",
                message = "This race already has a lead referee."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "REFEREE_CONFLICT_OF_INTEREST")
        {
            // Referee co quan he gia dinh truc he voi Owner trong Race
            return Conflict(new
            {
                error = "REFEREE_CONFLICT_OF_INTEREST",
                message = "This referee has a conflict of interest with an owner in this race."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "REFEREE_DOUBLE_BOOKED")
        {
            // Referee da duoc phan cong vao Race khac cung gio
            return Conflict(new
            {
                error = "REFEREE_DOUBLE_BOOKED",
                message = "This referee is already assigned to another race at the same time."
            });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetRefereesByRace(
        int raceId)
    {
        try
        {
            // Lay danh sach Referee da duoc gan vao Race
            var result = await _refereeAssignmentService.GetByRaceAsync(
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

    [HttpDelete("{refereeId:int}")]
    public async Task<IActionResult> RemoveReferee(
        int raceId,
        int refereeId)
    {
        try
        {
            // Go Referee khoi Race
            await _refereeAssignmentService.RemoveAsync(
                raceId,
                refereeId);

            return NoContent();
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "REFEREE_ASSIGNMENT_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "REFEREE_ASSIGNMENT_NOT_FOUND",
                message = "Referee assignment was not found."
            });
        }
    }
}