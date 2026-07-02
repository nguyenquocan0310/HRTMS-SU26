using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("referee")]
[ApiController]
[Route("api/referees/race-assignments")]
[Authorize(Roles = "Referee")]
public class RefereeMyAssignmentController : ControllerBase
{
    private readonly IRefereeAssignmentService _refereeAssignmentService;

    public RefereeMyAssignmentController(
        IRefereeAssignmentService refereeAssignmentService)
    {
        _refereeAssignmentService = refereeAssignmentService;
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyAssignments()
    {
        // Lay RefereeId tu JWT token
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var refereeId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Token khong hop le"
            });
        }

        var result = await _refereeAssignmentService
            .GetMyAssignmentsAsync(refereeId);

        return Ok(result);
    }
}