using System.Security.Claims;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly ITokenBlacklistService _tokenBlacklistService;

    public AdminController(
        HRTMSDbContext context,
        IAuditLogService auditLogService,
        ITokenBlacklistService tokenBlacklistService)
    {
        _context = context;
        _auditLogService = auditLogService;
        _tokenBlacklistService = tokenBlacklistService;
    }

    private int CurrentAdminId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private string? ClientIp =>
        HttpContext.Connection.RemoteIpAddress?.ToString();

    [HttpPatch("users/{id}/suspend")]
    public async Task<IActionResult> SuspendUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (user.Status == "Suspended")
            return BadRequest(new { message = "User is already suspended." });

        var oldStatus = user.Status;
        user.Status = "Suspended";
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // EC-29: invalidate any token issued before now for this user,
        // so subsequent requests with the old token get 401.
        await _tokenBlacklistService.BlacklistUserAsync(user.UserId);

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Suspend_User",
            entityName: "User",
            entityId: user.UserId.ToString(),
            oldValue: oldStatus,
            newValue: user.Status,
            ipAddress: ClientIp);

        return Ok(new { message = "User suspended successfully." });
    }

    [HttpPatch("referees/{id}/approve")]
    public async Task<IActionResult> ApproveReferee(int id)
    {
        var profile = await _context.RefereeProfiles.FindAsync(id);
        if (profile == null)
            return NotFound(new { message = "Referee profile not found." });

        if (profile.Status == "Approved")
            return BadRequest(new { message = "Referee is already approved." });

        var oldStatus = profile.Status;
        profile.Status = "Approved";
        profile.RejectionReason = null;
        profile.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Approve_Referee",
            entityName: "RefereeProfile",
            entityId: profile.RefereeId.ToString(),
            oldValue: oldStatus,
            newValue: profile.Status,
            ipAddress: ClientIp);

        return Ok(new { message = "Referee approved successfully." });
    }

    [HttpPatch("doctors/{id}/approve")]
    public async Task<IActionResult> ApproveDoctor(int id)
    {
        var profile = await _context.DoctorProfiles.FindAsync(id);
        if (profile == null)
            return NotFound(new { message = "Doctor profile not found." });

        if (profile.Status == "Approved")
            return BadRequest(new { message = "Doctor is already approved." });

        var oldStatus = profile.Status;
        profile.Status = "Approved";
        profile.RejectionReason = null;
        profile.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Approve_Doctor",
            entityName: "DoctorProfile",
            entityId: profile.DoctorId.ToString(),
            oldValue: oldStatus,
            newValue: profile.Status,
            ipAddress: ClientIp);

        return Ok(new { message = "Doctor approved successfully." });
    }
}