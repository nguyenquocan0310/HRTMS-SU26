using HRTMS.Core.DTOs.Doctor;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("doctor")]
[ApiController]
[Route("api/doctors")]
[Authorize]
public class DoctorController : ControllerBase
{
	private readonly IDoctorService _doctorService;

	public DoctorController(IDoctorService doctorService)
	{
		_doctorService = doctorService;
	}

	[HttpGet("profile")]
	[Authorize(Roles = "Doctor")]
	public async Task<IActionResult> GetProfile()
	{
		var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (!int.TryParse(userIdValue, out var doctorId))
			return Unauthorized(new { error = "UNAUTHORIZED", message = "Invalid or missing user identity." });

		var profile = await _doctorService.GetProfileAsync(doctorId);
		if (profile == null)
			return NotFound(new { error = "DOCTOR_PROFILE_NOT_FOUND", message = "Doctor profile was not found." });

		return Ok(profile);
	}

	/// <summary>REQ-F-ACC.3 (mở rộng) — Doctor tự cập nhật MedicalLicenseNumber; đổi giá trị sẽ đưa hồ sơ về Pending để Admin duyệt lại.</summary>
	[HttpPatch("profile")]
	[Authorize(Roles = "Doctor")]
	public async Task<IActionResult> UpdateProfile([FromBody] UpdateDoctorProfileDto dto)
	{
		if (!ModelState.IsValid) return BadRequest(ModelState);

		var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
		if (!int.TryParse(userIdValue, out var doctorId))
			return Unauthorized(new { error = "UNAUTHORIZED", message = "Invalid or missing user identity." });

		try
		{
			var profile = await _doctorService.UpdateProfileAsync(doctorId, dto);
			if (profile == null)
				return NotFound(new { error = "DOCTOR_PROFILE_NOT_FOUND", message = "Doctor profile was not found." });

			return Ok(new
			{
				doctorId = profile.DoctorId,
				status = profile.Status,
				message = profile.Status == "Pending"
					? "Doctor profile updated. Medical license changed — awaiting Admin re-approval."
					: "Doctor profile updated successfully."
			});
		}
		catch (InvalidOperationException ex) when (ex.Message == "LICENSE_ALREADY_EXISTS")
		{
			return Conflict(new { error = "LICENSE_ALREADY_EXISTS", message = "Medical license number is already in use by another doctor." });
		}
	}
}