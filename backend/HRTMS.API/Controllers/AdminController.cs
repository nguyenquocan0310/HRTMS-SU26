using System.Security.Claims;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;

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

        var user = await _context.Users.FindAsync(profile.RefereeId);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (profile.Status == "Active" && user.Status == "Active")
            return BadRequest(new { message = "Referee is already active." });

        var oldProfileStatus = profile.Status;
        var oldUserStatus = user.Status;

        profile.Status = "Active";
        profile.RejectionReason = null;
        profile.UpdatedAt = DateTime.UtcNow;

        user.Status = "Active";
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Approve_Referee",
            entityName: "RefereeProfile",
            entityId: profile.RefereeId.ToString(),
            oldValue: $"RefereeProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"RefereeProfile.Status={profile.Status}, User.Status={user.Status}",
            ipAddress: ClientIp);

        return Ok(new { message = "Referee approved and activated successfully." });
    }

    [HttpPatch("doctors/{id}/approve")]
    public async Task<IActionResult> ApproveDoctor(int id)
    {
        var profile = await _context.DoctorProfiles.FindAsync(id);
        if (profile == null)
            return NotFound(new { message = "Doctor profile not found." });

        var user = await _context.Users.FindAsync(profile.DoctorId);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (profile.Status == "Active" && user.Status == "Active")
            return BadRequest(new { message = "Doctor is already active." });

        var oldProfileStatus = profile.Status;
        var oldUserStatus = user.Status;

        profile.Status = "Active";
        profile.RejectionReason = null;
        profile.UpdatedAt = DateTime.UtcNow;

        user.Status = "Active";
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Approve_Doctor",
            entityName: "DoctorProfile",
            entityId: profile.DoctorId.ToString(),
            oldValue: $"DoctorProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"DoctorProfile.Status={profile.Status}, User.Status={user.Status}",
            ipAddress: ClientIp);

        return Ok(new { message = "Doctor approved and activated successfully." });
    }
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? role,
        [FromQuery] string? status)
    {
        var query = _context.Users.AsQueryable();

        if (!string.IsNullOrEmpty(role))
            query = query.Where(u => u.Role == role);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(u => u.Status == status);

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new
            {
                u.UserId,
                u.Username,
                u.FullName,
                u.Email,
                u.Role,
                u.Status,
                u.CreatedAt
            })
            .ToListAsync();

        return Ok(new { success = true, data = users });
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        var user = await _context.Users
            .Where(u => u.UserId == id)
            .Select(u => new
            {
                u.UserId,
                u.Username,
                u.FullName,
                u.Email,
                u.Role,
                u.Status,
                u.FailedLoginAttempts,
                u.LockoutEnd,
                u.CreatedAt,
                u.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (user == null)
            return NotFound(new { message = "User not found." });

        return Ok(new { success = true, data = user });
    }

    [HttpGet("pending-approvals")]
    public async Task<IActionResult> GetPendingApprovals()
    {
        var referees = await _context.RefereeProfiles
            .Where(r => r.Status == "Pending")
            .Join(_context.Users,
                r => r.RefereeId,
                u => u.UserId,
                (r, u) => new
                {
                    u.UserId,
                    u.Username,
                    u.FullName,
                    u.Email,
                    Role = "Referee",
                    ProfileStatus = r.Status,
                    r.CertificationLevel,
                    r.CreatedAt
                })
            .ToListAsync();

        var doctors = await _context.DoctorProfiles
            .Where(d => d.Status == "Pending")
            .Join(_context.Users,
                d => d.DoctorId,
                u => u.UserId,
                (d, u) => new
                {
                    u.UserId,
                    u.Username,
                    u.FullName,
                    u.Email,
                    Role = "Doctor",
                    ProfileStatus = d.Status,
                    CertificationLevel = d.MedicalLicenseNumber,
                    d.CreatedAt
                })
            .ToListAsync();

        var jockeys = await _context.JockeyProfiles
            .Where(j => j.Status == "Pending")
            .Join(_context.Users,
                j => j.JockeyId,
                u => u.UserId,
                (j, u) => new
                {
                    u.UserId,
                    u.Username,
                    u.FullName,
                    u.Email,
                    Role = "Jockey",
                    ProfileStatus = j.Status,
                    CertificationLevel = j.LicenseCertificate,
                    j.CreatedAt
                })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            data = new
            {
                referees,
                doctors,
                jockeys,
                totalPending = referees.Count + doctors.Count + jockeys.Count
            }
        });
    }
}