using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Horse;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("admin")]
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly ITokenBlacklistService _tokenBlacklistService;
    private readonly IHorseService _horseService;

    public AdminController(
        HRTMSDbContext context,
        IAuditLogService auditLogService,
        ITokenBlacklistService tokenBlacklistService,
        IHorseService horseService)
    {
        _context = context;
        _auditLogService = auditLogService;
        _tokenBlacklistService = tokenBlacklistService;
        _horseService = horseService;
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

        if (id == CurrentAdminId)
            return BadRequest(new { message = "Admin không thể tự suspend tài khoản của mình." });

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

    // REQ-F-ACC.4 — Kích hoạt lại tài khoản đã Suspended
    // Không áp dụng cho Jockey/Referee/Doctor đang Pending onboarding
    // (dùng endpoint approve riêng cho từng role đó).
    [HttpPatch("users/{id}/activate")]
    public async Task<IActionResult> ActivateUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (user.Status != "Suspended")
            return BadRequest(new { message = $"Chỉ có thể kích hoạt lại tài khoản đang Suspended. Trạng thái hiện tại: {user.Status}." });

        var oldStatus = user.Status;
        user.Status = "Active";
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Activate_User",
            entityName: "User",
            entityId: user.UserId.ToString(),
            oldValue: oldStatus,
            newValue: user.Status,
            ipAddress: ClientIp);

        return Ok(new { message = "Tài khoản đã được kích hoạt lại." });
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

    [HttpPatch("jockeys/{id}/approve")]
    public async Task<IActionResult> ApproveJockey(int id)
    {
        var profile = await _context.JockeyProfiles.FindAsync(id);
        if (profile == null)
            return NotFound(new { message = "Jockey profile not found." });

        var user = await _context.Users.FindAsync(profile.JockeyId);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (profile.Status == "Active" && user.Status == "Active")
            return BadRequest(new { message = "Jockey is already active." });

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
            action: "Approve_Jockey",
            entityName: "JockeyProfile",
            entityId: profile.JockeyId.ToString(),
            oldValue: $"JockeyProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"JockeyProfile.Status={profile.Status}, User.Status={user.Status}",
            ipAddress: ClientIp);

        return Ok(new { message = "Jockey approved and activated successfully." });
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
    // ── MODULE C: Horse Enrollment Approval (duyệt ngựa theo từng giải) ────────

    [HttpGet("horse-entries/pending")]
    [ProducesResponseType(typeof(ApiResponse<List<HorseEnrollmentResponseDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendingEnrollments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _horseService.GetPendingEnrollmentsAsync(page, pageSize);
        return Ok(result);
    }

    [HttpGet("horses/{id:int}")]
    [ProducesResponseType(typeof(ApiResponse<HorseResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHorseAdmin(int id)
    {
        var result = await _horseService.GetHorseByIdAdminAsync(id);
        if (!result.Success) return NotFound(result);
        return Ok(result);
    }

    [HttpPatch("horse-entries/{id:int}/approve")]
    [ProducesResponseType(typeof(ApiResponse<string>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ApproveEnrollment(int id)
    {
        var result = await _horseService.ApproveEnrollmentAsync(CurrentAdminId, id);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPatch("horse-entries/{id:int}/reject")]
    [ProducesResponseType(typeof(ApiResponse<string>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RejectEnrollment(int id, [FromBody] AdminRejectHorseDto dto)
    {
        var result = await _horseService.RejectEnrollmentAsync(CurrentAdminId, id, dto);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }
    // ── MODULE C: Race Entry Admin ────────────────────────────────────────────

    [HttpGet("entries/pending-fee")]
    public async Task<IActionResult> GetPendingFeeEntries(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _horseService.GetPendingFeeEntriesAsync(page, pageSize);
        return Ok(result);
    }

    [HttpPatch("entries/{id:int}/fee-status")]
    public async Task<IActionResult> ConfirmEntryFee(int id)
    {
        var result = await _horseService.ConfirmEntryFeeAsync(CurrentAdminId, id);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPatch("entries/{id:int}/approve")]
    public async Task<IActionResult> ApproveRaceEntry(int id)
    {
        var result = await _horseService.ApproveRaceEntryAsync(CurrentAdminId, id);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }

    [HttpPatch("entries/{id:int}/reject")]
    public async Task<IActionResult> RejectRaceEntry(int id, [FromBody] AdminRejectHorseDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var result = await _horseService.RejectRaceEntryAsync(CurrentAdminId, id, dto.Reason);
        if (!result.Success) return BadRequest(result);
        return Ok(result);
    }
    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(
    [FromQuery] string? action,
    [FromQuery] string? entityName,
    [FromQuery] int? actorId,
    [FromQuery] DateTime? from,
    [FromQuery] DateTime? to,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20)
    {
        var query = _context.AuditLogs.AsQueryable();

        if (!string.IsNullOrEmpty(action))
            query = query.Where(a => a.Action == action);
        if (!string.IsNullOrEmpty(entityName))
            query = query.Where(a => a.EntityName == entityName);
        if (actorId.HasValue)
            query = query.Where(a => a.ActorId == actorId.Value);
        if (from.HasValue)
            query = query.Where(a => a.CreatedAt >= from.Value);
        if (to.HasValue)
            query = query.Where(a => a.CreatedAt <= to.Value);

        var total = await query.CountAsync();
        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.AuditLogId,
                a.ActorId,
                a.Action,
                a.EntityName,
                a.EntityId,
                a.OldValue,
                a.NewValue,
                a.IpAddress,
                a.UserAgent,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(new { success = true, total, page, pageSize, data = logs });
    }

}