using HRTMS.Core.DTOs.Referee;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("referee")]
[ApiController]
[Route("api/referees")]
[Authorize]
public class RefereeController : ControllerBase
{
    private readonly IRefereeService _refereeService;

    public RefereeController(IRefereeService refereeService)
    {
        _refereeService = refereeService;
    }

    [HttpGet("profile")]
    [Authorize(Roles = "Referee")]
    public async Task<IActionResult> GetProfile()
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdValue, out var refereeId))
            return Unauthorized(new { error = "UNAUTHORIZED", message = "Invalid or missing user identity." });

        var profile = await _refereeService.GetProfileAsync(refereeId);
        if (profile == null)
            return NotFound(new { error = "REFEREE_PROFILE_NOT_FOUND", message = "Referee profile was not found." });

        return Ok(profile);
    }

    /// <summary>REQ-F-ACC.3 (mở rộng) — Referee tự cập nhật CertificationLevel; đổi giá trị sẽ đưa hồ sơ về Pending để Admin duyệt lại.</summary>
    [HttpPatch("profile")]
    [Authorize(Roles = "Referee")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateRefereeProfileDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdValue, out var refereeId))
            return Unauthorized(new { error = "UNAUTHORIZED", message = "Invalid or missing user identity." });

        var profile = await _refereeService.UpdateProfileAsync(refereeId, dto);
        if (profile == null)
            return NotFound(new { error = "REFEREE_PROFILE_NOT_FOUND", message = "Referee profile was not found." });

        return Ok(new
        {
            refereeId = profile.RefereeId,
            status = profile.Status,
            message = profile.Status == "Pending"
                ? "Referee profile updated. Certification changed — awaiting Admin re-approval."
                : "Referee profile updated successfully."
        });
    }
}