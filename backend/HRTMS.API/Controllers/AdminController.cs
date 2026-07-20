using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;
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
    private readonly IAuthService _authService;
    private readonly INotificationService _notificationService;

    public AdminController(
        HRTMSDbContext context,
        IAuditLogService auditLogService,
        ITokenBlacklistService tokenBlacklistService,
        IHorseService horseService,
        IAuthService authService,
        INotificationService notificationService)
    {
        _context = context;
        _auditLogService = auditLogService;
        _tokenBlacklistService = tokenBlacklistService;
        _horseService = horseService;
        _authService = authService;
        _notificationService = notificationService;
    }

    private int CurrentAdminId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private string? ClientIp =>
        HttpContext.Connection.RemoteIpAddress?.ToString();

    // REQ-F-ACC.2 — Admin tạo tài khoản cho bất kỳ role nào, kể cả Admin.
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] AdminCreateUserDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var ip = ClientIp;
        var ua = HttpContext.Request.Headers["User-Agent"].ToString();
        var result = await _authService.AdminCreateUserAsync(dto, CurrentAdminId, ip, ua);
        if (!result.Success)
        {
            var isConflict = result.Message?.Contains("tồn tại") == true;
            return isConflict ? Conflict(result) : BadRequest(result);
        }
        return CreatedAtAction(nameof(GetUserById), new { id = result.Data }, result);
    }

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
            action: "Tạm ngưng tài khoản",
            entityName: "User",
            entityId: user.UserId.ToString(),
            oldValue: oldStatus,
            newValue: user.Status,
            ipAddress: ClientIp);

        // Cảnh báo bảo mật: user cần biết ngay tài khoản bị khóa và vì sao,
        // tránh hoang mang khi đăng nhập lại bị từ chối không rõ lý do.
        await _notificationService.SendAsync(
            user.UserId,
            "Tài khoản của bạn đã bị tạm khóa",
            "Tài khoản của bạn vừa bị Admin tạm khóa (Suspended). Mọi phiên đăng nhập hiện tại đã bị vô hiệu hoá. " +
            "Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ Admin để được hỗ trợ.",
            type: "Both",
            relatedEntityType: "Users",
            relatedEntityId: user.UserId);

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
            action: "Kích hoạt tài khoản",
            entityName: "User",
            entityId: user.UserId.ToString(),
            oldValue: oldStatus,
            newValue: user.Status,
            ipAddress: ClientIp);

        await _notificationService.SendAsync(
            user.UserId,
            "Tài khoản của bạn đã được kích hoạt lại",
            "Tài khoản của bạn đã được Admin kích hoạt lại. Bạn có thể đăng nhập và sử dụng bình thường.",
            type: "Both",
            relatedEntityType: "Users",
            relatedEntityId: user.UserId);

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
            action: "Duyệt hồ sơ trọng tài",
            entityName: "RefereeProfile",
            entityId: profile.RefereeId.ToString(),
            oldValue: $"RefereeProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"RefereeProfile.Status={profile.Status}, User.Status={user.Status}",
            ipAddress: ClientIp);

        await _notificationService.SendAsync(
            user.UserId,
            "Hồ sơ Trọng tài đã được duyệt",
            "Hồ sơ đăng ký Trọng tài của bạn đã được Admin phê duyệt. Tài khoản đã được kích hoạt.",
            type: "Both",
            relatedEntityType: "RefereeProfile",
            relatedEntityId: profile.RefereeId);

        return Ok(new { message = "Referee approved and activated successfully." });
    }

    // REQ-F-ACC.7 #4 — Admin reject onboarding chuyên môn: profile -> Rejected, lưu lý do, notify user.
    [HttpPatch("referees/{id}/reject")]
    public async Task<IActionResult> RejectReferee(int id, [FromBody] AdminRejectHorseDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var profile = await _context.RefereeProfiles.FindAsync(id);
        if (profile == null)
            return NotFound(new { message = "Referee profile not found." });

        var user = await _context.Users.FindAsync(profile.RefereeId);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (profile.Status == "Active" && user.Status == "Active")
            return BadRequest(new { message = "Referee đã Active, không thể reject. Hãy dùng Suspend nếu cần vô hiệu hóa." });

        var oldProfileStatus = profile.Status;
        var oldUserStatus = user.Status;

        profile.Status = "Rejected";
        profile.RejectionReason = dto.Reason;
        profile.UpdatedAt = DateTime.UtcNow;

        user.Status = "Rejected";
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Từ chối hồ sơ trọng tài",
            entityName: "RefereeProfile",
            entityId: profile.RefereeId.ToString(),
            oldValue: $"RefereeProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"RefereeProfile.Status={profile.Status}, User.Status={user.Status}; Reason={dto.Reason}",
            ipAddress: ClientIp);

        await _notificationService.SendAsync(
            user.UserId,
            "Hồ sơ Trọng tài bị từ chối",
            $"Hồ sơ đăng ký Trọng tài của bạn bị từ chối. Lý do: {dto.Reason}",
            type: "Both",
            relatedEntityType: "RefereeProfile",
            relatedEntityId: profile.RefereeId);

        return Ok(new { message = "Referee onboarding rejected." });
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
            action: "Duyệt hồ sơ bác sĩ",
            entityName: "DoctorProfile",
            entityId: profile.DoctorId.ToString(),
            oldValue: $"DoctorProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"DoctorProfile.Status={profile.Status}, User.Status={user.Status}",
            ipAddress: ClientIp);

        await _notificationService.SendAsync(
            user.UserId,
            "Hồ sơ Bác sĩ đã được duyệt",
            "Hồ sơ đăng ký Bác sĩ của bạn đã được Admin phê duyệt. Tài khoản đã được kích hoạt.",
            type: "Both",
            relatedEntityType: "DoctorProfile",
            relatedEntityId: profile.DoctorId);

        return Ok(new { message = "Doctor approved and activated successfully." });
    }

    // REQ-F-ACC.7 #4 — Admin reject onboarding chuyên môn: profile -> Rejected, lưu lý do, notify user.
    [HttpPatch("doctors/{id}/reject")]
    public async Task<IActionResult> RejectDoctor(int id, [FromBody] AdminRejectHorseDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var profile = await _context.DoctorProfiles.FindAsync(id);
        if (profile == null)
            return NotFound(new { message = "Doctor profile not found." });

        var user = await _context.Users.FindAsync(profile.DoctorId);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (profile.Status == "Active" && user.Status == "Active")
            return BadRequest(new { message = "Doctor đã Active, không thể reject. Hãy dùng Suspend nếu cần vô hiệu hóa." });

        var oldProfileStatus = profile.Status;
        var oldUserStatus = user.Status;

        profile.Status = "Rejected";
        profile.RejectionReason = dto.Reason;
        profile.UpdatedAt = DateTime.UtcNow;

        user.Status = "Rejected";
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Từ chối hồ sơ bác sĩ",
            entityName: "DoctorProfile",
            entityId: profile.DoctorId.ToString(),
            oldValue: $"DoctorProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"DoctorProfile.Status={profile.Status}, User.Status={user.Status}; Reason={dto.Reason}",
            ipAddress: ClientIp);

        await _notificationService.SendAsync(
            user.UserId,
            "Hồ sơ Bác sĩ bị từ chối",
            $"Hồ sơ đăng ký Bác sĩ của bạn bị từ chối. Lý do: {dto.Reason}",
            type: "Both",
            relatedEntityType: "DoctorProfile",
            relatedEntityId: profile.DoctorId);

        return Ok(new { message = "Doctor onboarding rejected." });
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
            action: "Duyệt hồ sơ nài ngựa",
            entityName: "JockeyProfile",
            entityId: profile.JockeyId.ToString(),
            oldValue: $"JockeyProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"JockeyProfile.Status={profile.Status}, User.Status={user.Status}",
            ipAddress: ClientIp);

        await _notificationService.SendAsync(
            user.UserId,
            "Hồ sơ Nài ngựa đã được duyệt",
            "Hồ sơ đăng ký Nài ngựa của bạn đã được Admin phê duyệt. Tài khoản đã được kích hoạt.",
            type: "Both",
            relatedEntityType: "JockeyProfile",
            relatedEntityId: profile.JockeyId);

        return Ok(new { message = "Jockey approved and activated successfully." });
    }

    // REQ-F-ACC.7 #4 — Admin reject onboarding chuyên môn: profile -> Rejected, lưu lý do, notify user.
    [HttpPatch("jockeys/{id}/reject")]
    public async Task<IActionResult> RejectJockey(int id, [FromBody] AdminRejectHorseDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var profile = await _context.JockeyProfiles.FindAsync(id);
        if (profile == null)
            return NotFound(new { message = "Jockey profile not found." });

        var user = await _context.Users.FindAsync(profile.JockeyId);
        if (user == null)
            return NotFound(new { message = "User not found." });

        if (profile.Status == "Active" && user.Status == "Active")
            return BadRequest(new { message = "Jockey đã Active, không thể reject. Hãy dùng Suspend nếu cần vô hiệu hóa." });

        var oldProfileStatus = profile.Status;
        var oldUserStatus = user.Status;

        profile.Status = "Rejected";
        profile.RejectionReason = dto.Reason;
        profile.UpdatedAt = DateTime.UtcNow;

        user.Status = "Rejected";
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync(
            actorId: CurrentAdminId,
            action: "Từ chối hồ sơ nài ngựa",
            entityName: "JockeyProfile",
            entityId: profile.JockeyId.ToString(),
            oldValue: $"JockeyProfile.Status={oldProfileStatus}, User.Status={oldUserStatus}",
            newValue: $"JockeyProfile.Status={profile.Status}, User.Status={user.Status}; Reason={dto.Reason}",
            ipAddress: ClientIp);

        await _notificationService.SendAsync(
            user.UserId,
            "Hồ sơ Nài ngựa bị từ chối",
            $"Hồ sơ đăng ký Nài ngựa của bạn bị từ chối. Lý do: {dto.Reason}",
            type: "Both",
            relatedEntityType: "JockeyProfile",
            relatedEntityId: profile.JockeyId);

        return Ok(new { message = "Jockey onboarding rejected." });
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
                u.PhoneNumber,
                u.DateOfBirth,
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
        var certificatesByUser = await _context.Certificates
            .AsNoTracking()
            .ToDictionaryAsync(c => c.UserId, c => new
            {
                c.CertificateId,
                c.FileName,
                c.ContentType,
                c.FileSizeBytes,
                c.UploadedAt,
                DownloadUrl = $"/api/certificates/{c.CertificateId}/download"
            });

        var referees = await _context.RefereeProfiles
            .Where(r => r.Status == "Pending")
             .Join(_context.Users.Where(u => u.Status != "Suspended"),
                r => r.RefereeId,
                u => u.UserId,
                (r, u) => new
                {
                    u.UserId,
                    u.Username,
                    u.FullName,
                    u.Email,
                    u.PhoneNumber,
                    u.DateOfBirth,
                    Role = "Referee",
                    ProfileStatus = r.Status,
                    r.CertificationLevel,
                    r.CreatedAt
                })
            .ToListAsync();

        var doctors = await _context.DoctorProfiles
            .Where(d => d.Status == "Pending")
            .Join(_context.Users.Where(u => u.Status != "Suspended"),
                d => d.DoctorId,
                u => u.UserId,
                (d, u) => new
                {
                    u.UserId,
                    u.Username,
                    u.FullName,
                    u.Email,
                    u.PhoneNumber,
                    u.DateOfBirth,
                    Role = "Doctor",
                    ProfileStatus = d.Status,
                    CertificationLevel = d.MedicalLicenseNumber,
                    d.CreatedAt
                })
            .ToListAsync();

        var jockeys = await _context.JockeyProfiles
            .Where(j => j.Status == "Pending")
             .Join(_context.Users.Where(u => u.Status != "Suspended"),
                j => j.JockeyId,
                u => u.UserId,
                (j, u) => new
                {
                    u.UserId,
                    u.Username,
                    u.FullName,
                    u.Email,
                    u.PhoneNumber,
                    u.DateOfBirth,
                    Role = "Jockey",
                    ProfileStatus = j.Status,
                    CertificationLevel = j.LicenseCertificate,
                    j.CreatedAt
                })
            .ToListAsync();

        // Đính kèm thông tin file chứng chỉ đã upload (nếu có) để Admin xem trực tiếp
        // khi duyệt hồ sơ, thay vì chỉ thấy tên file dạng text.
        var refereesWithCert = referees.Select(r => new
        {
            r.UserId,
            r.Username,
            r.FullName,
            r.Email,
            r.PhoneNumber,
            r.DateOfBirth,
            r.Role,
            r.ProfileStatus,
            r.CertificationLevel,
            r.CreatedAt,
            Certificate = certificatesByUser.GetValueOrDefault(r.UserId)
        });

        var doctorsWithCert = doctors.Select(d => new
        {
            d.UserId,
            d.Username,
            d.FullName,
            d.Email,
            d.PhoneNumber,
            d.DateOfBirth,
            d.Role,
            d.ProfileStatus,
            d.CertificationLevel,
            d.CreatedAt,
            Certificate = certificatesByUser.GetValueOrDefault(d.UserId)
        });

        var jockeysWithCert = jockeys.Select(j => new
        {
            j.UserId,
            j.Username,
            j.FullName,
            j.Email,
            j.PhoneNumber,
            j.DateOfBirth,
            j.Role,
            j.ProfileStatus,
            j.CertificationLevel,
            j.CreatedAt,
            Certificate = certificatesByUser.GetValueOrDefault(j.UserId)
        });

        return Ok(new
        {
            success = true,
            data = new
            {
                referees = refereesWithCert,
                doctors = doctorsWithCert,
                jockeys = jockeysWithCert,
                totalPending = referees.Count + doctors.Count + jockeys.Count
            }
        });
    }
    // Danh sách cán bộ đủ điều kiện để phân công cho một Race cụ thể.
    // Hồ sơ phải Active và đã được duyệt trong roster của đúng Tournament.
    [HttpGet("races/{raceId:int}/available-officials")]
    public async Task<IActionResult> GetAvailableOfficials(int raceId)
    {
        var race = await _context.Races
            .AsNoTracking()
            .Where(r => r.RaceId == raceId)
            .Select(r => new
            {
                r.RaceId,
                TournamentId = r.Round.TournamentId,
                r.ScheduledTime
            })
            .FirstOrDefaultAsync();

        if (race is null)
            return NotFound(new { success = false, message = "Không tìm thấy Race." });

        var referees = await (
            from profile in _context.RefereeProfiles.AsNoTracking()
            join user in _context.Users.AsNoTracking()
                on profile.RefereeId equals user.UserId
            where profile.Status == "Active"
                && _context.TournamentParticipants.Any(p =>
                    p.TournamentId == race.TournamentId
                    && p.UserId == profile.RefereeId
                    && p.Role == "Referee"
                    && p.Status == "Approved")
                && !_context.RefereeAssignments.Any(a =>
                    a.RaceId == raceId && a.RefereeId == profile.RefereeId)
                && !_context.RefereeAssignments.Any(a =>
                    a.RefereeId == profile.RefereeId
                    && a.RaceId != raceId
                    && a.Race.ScheduledTime == race.ScheduledTime
                    && a.Race.Status != "Cancelled")
            orderby user.FullName
            select new
            {
                UserId = user.UserId,
                user.Username,
                user.FullName,
                user.Email,
                Role = "Referee",
                ProfileStatus = profile.Status,
                CertificationLevel = profile.CertificationLevel,
                profile.CreatedAt
            })
            .ToListAsync();

        var doctors = await (
            from profile in _context.DoctorProfiles.AsNoTracking()
            join user in _context.Users.AsNoTracking()
                on profile.DoctorId equals user.UserId
            where profile.Status == "Active"
                && _context.TournamentParticipants.Any(p =>
                    p.TournamentId == race.TournamentId
                    && p.UserId == profile.DoctorId
                    && p.Role == "Doctor"
                    && p.Status == "Approved")
                && !_context.DoctorAssignments.Any(a =>
                    a.RaceId == raceId && a.DoctorId == profile.DoctorId)
                && !_context.DoctorAssignments.Any(a =>
                    a.DoctorId == profile.DoctorId
                    && a.RaceId != raceId
                    && a.Race.ScheduledTime == race.ScheduledTime
                    && a.Race.Status != "Cancelled")
            orderby user.FullName
            select new
            {
                UserId = user.UserId,
                user.Username,
                user.FullName,
                user.Email,
                Role = "Doctor",
                ProfileStatus = profile.Status,
                CertificationLevel = profile.MedicalLicenseNumber,
                profile.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            success = true,
            data = new { referees, doctors }
        });
    }

    // ── MODULE C: Horse Enrollment Approval (duyệt ngựa theo từng giải) ────────

    [HttpGet("horse-entries")]
    [ProducesResponseType(typeof(ApiResponse<List<HorseEnrollmentResponseDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetEnrollments(
        [FromQuery] int? tournamentId,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var result = await _horseService.GetEnrollmentsAsync(tournamentId, status, page, pageSize);
            return Ok(result);
        }
        catch (ArgumentException ex)
            when (ex.Message == "INVALID_ENROLLMENT_STATUS")
        {
            return BadRequest(new
            {
                error = "VALIDATION_ERROR",
                message = "Status must be Pending, Approved, or Rejected."
            });
        }
    }

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

    // Module E — liet ke MOI RaceEntry theo filter (khong khoa Unpaid nhu pending-fee).
    [HttpGet("entries")]
    public async Task<IActionResult> GetAdminRaceEntries(
        [FromQuery] string? status,
        [FromQuery] string? feeStatus,
        [FromQuery] int? tournamentId,
        [FromQuery] int? raceId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var result = await _horseService.GetAdminRaceEntriesAsync(
            status, feeStatus, tournamentId, raceId, page, pageSize);
        return Ok(result);
    }

    // Module E — dong vong hoan phi: Refund Pending -> Refunded.
    [HttpPatch("entries/{id:int}/refund-complete")]
    public async Task<IActionResult> CompleteRefund(int id)
    {
        var result = await _horseService.CompleteRefundAsync(CurrentAdminId, id);
        if (!result.Success) return BadRequest(result);
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
