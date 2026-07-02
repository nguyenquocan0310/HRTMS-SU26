using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("prerace")]
[ApiController]
[Route("api/doctors/race-assignments")]
[Authorize(Roles = "Doctor")]
public class DoctorMyAssignmentController : ControllerBase
{
    private readonly IDoctorAssignmentService _doctorAssignmentService;

    public DoctorMyAssignmentController(
        IDoctorAssignmentService doctorAssignmentService)
    {
        _doctorAssignmentService = doctorAssignmentService;
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyAssignments()
    {
        // Lay DoctorId tu JWT token
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var doctorId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Token khong hop le"
            });
        }

        var result = await _doctorAssignmentService
            .GetMyAssignmentsAsync(doctorId);

        return Ok(result);
    }
}