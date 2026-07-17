using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class ProfileService : IProfileService
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLog;
    private readonly INotificationService _notificationService;
    private readonly IEmailService _emailService;

    public ProfileService(
        HRTMSDbContext context,
        IAuditLogService auditLog,
        INotificationService notificationService,
        IEmailService emailService)
    {
        _context = context;
        _auditLog = auditLog;
        _notificationService = notificationService;
        _emailService = emailService;
    }

    public async Task<ApiResponse<UserProfileDto>> GetProfileAsync(int userId)
    {
        var user = await _context.Users
            .AsNoTracking()
            .Where(u => u.UserId == userId)
            .FirstOrDefaultAsync();

        if (user == null)
            return ApiResponse<UserProfileDto>.Fail("Không tìm thấy người dùng.");

        var profile = new UserProfileDto
        {
            UserId = user.UserId,
            Username = user.Username,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            Status = user.Status,
            Profile = await GetRoleProfileAsync(userId, user.Role)
        };

        return ApiResponse<UserProfileDto>.Ok(profile);
    }

    // =========================================================
    // REQ-F-ACC.3 — Cập nhật FullName và Email
    // =========================================================
    public async Task<ApiResponse<bool>> UpdateBasicInfoAsync(
        int userId, UpdateBasicInfoDto dto, string? ipAddress)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return ApiResponse<bool>.Fail("Không tìm thấy người dùng.");

        // Email mới trùng với user khác → reject
        var emailTaken = await _context.Users
            .AnyAsync(u => u.Email == dto.Email && u.UserId != userId);
        if (emailTaken)
            return ApiResponse<bool>.Fail("Email đã được sử dụng bởi tài khoản khác.");

        var oldEmail = user.Email;
        var oldFullName = user.FullName;
        var now = DateTime.UtcNow;

        user.FullName = dto.FullName.Trim();
        user.Email = dto.Email.Trim().ToLower();
        user.UpdatedAt = now;

        await _context.SaveChangesAsync();

        var emailChanged = !string.Equals(oldEmail, user.Email, StringComparison.OrdinalIgnoreCase);

        await _auditLog.LogAsync(
            actorId: userId,
            action: "Update_Profile",
            entityName: "Users",
            entityId: userId.ToString(),
            oldValue: $"FullName={oldFullName}, Email={oldEmail}",
            newValue: $"FullName={user.FullName}, Email={user.Email}",
            ipAddress: ipAddress
        );

        if (emailChanged)
        {
            // Cảnh báo bảo mật gửi tới CẢ email cũ lẫn mới — nếu không phải chính chủ
            // thực hiện, chủ tài khoản thật (đang còn quyền truy cập email cũ) cần biết
            // ngay để phát hiện chiếm đoạt tài khoản.
            await _emailService.SendAsync(
                oldEmail, oldFullName,
                "Email tài khoản HRTMS của bạn vừa được thay đổi",
                $"<p>Email đăng nhập của tài khoản <b>{System.Net.WebUtility.HtmlEncode(oldFullName)}</b> " +
                $"vừa được đổi từ <b>{System.Net.WebUtility.HtmlEncode(oldEmail)}</b> sang " +
                $"<b>{System.Net.WebUtility.HtmlEncode(user.Email)}</b> lúc {now:HH:mm dd/MM/yyyy} (UTC).</p>" +
                "<p>Nếu đây không phải do bạn thực hiện, vui lòng liên hệ Admin ngay lập tức.</p>");

            await _notificationService.SendAsync(
                user.UserId,
                "Email tài khoản đã được cập nhật",
                $"Email đăng nhập của bạn đã được đổi thành công sang {user.Email} lúc {now:HH:mm dd/MM/yyyy}.",
                type: "Both",
                relatedEntityType: "Users",
                relatedEntityId: user.UserId);
        }

        return ApiResponse<bool>.Ok(true, "Cập nhật thông tin thành công.");
    }

    // =========================================================
    // REQ-F-ACC.3 — Đổi mật khẩu
    // =========================================================
    public async Task<ApiResponse<bool>> ChangePasswordAsync(
        int userId, ChangePasswordDto dto, string? ipAddress)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return ApiResponse<bool>.Fail("Không tìm thấy người dùng.");

        // Xác thực mật khẩu hiện tại trước khi cho đổi (REQ-F-ACC.3)
        if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword, user.PasswordHash))
            return ApiResponse<bool>.Fail("Mật khẩu hiện tại không đúng.");

        // Không cho đặt lại mật khẩu giống cũ
        if (BCrypt.Net.BCrypt.Verify(dto.NewPassword, user.PasswordHash))
            return ApiResponse<bool>.Fail("Mật khẩu mới phải khác mật khẩu hiện tại.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword, workFactor: 12);
        var changedAt = DateTime.UtcNow;
        user.UpdatedAt = changedAt;

        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: userId,
            action: "Change_Password",
            entityName: "Users",
            entityId: userId.ToString(),
            ipAddress: ipAddress
        );

        // Cảnh báo bảo mật: nếu không phải chính chủ đổi, họ cần biết ngay.
        await _notificationService.SendAsync(
            userId,
            "Mật khẩu tài khoản vừa được thay đổi",
            $"Mật khẩu đăng nhập của bạn vừa được thay đổi thành công lúc {changedAt:HH:mm dd/MM/yyyy} (UTC). " +
            "Nếu đây không phải do bạn thực hiện, vui lòng liên hệ Admin ngay lập tức.",
            type: "Both",
            relatedEntityType: "Users",
            relatedEntityId: userId);

        return ApiResponse<bool>.Ok(true, "Đổi mật khẩu thành công.");
    }

    // =========================================================
    // PRIVATE — profile mở rộng theo role
    // =========================================================
    private async Task<object?> GetRoleProfileAsync(int userId, string role)
    {
        object? certificate = null;
        if (role is "Jockey" or "Referee" or "Doctor")
        {
            certificate = await _context.Certificates
                .AsNoTracking()
                .Where(c => c.UserId == userId)
                .Select(c => new
                {
                    c.CertificateId,
                    c.FileName,
                    c.ContentType,
                    c.FileSizeBytes,
                    c.UploadedAt,
                    DownloadUrl = $"/api/certificates/{c.CertificateId}/download"
                })
                .FirstOrDefaultAsync();
        }

        return role switch
        {
            "Jockey" => await _context.JockeyProfiles
                .AsNoTracking()
                .Where(j => j.JockeyId == userId)
                .Join(_context.Users.AsNoTracking(),
                    j => j.JockeyId, u => u.UserId,
                    (j, u) => new {
                        j.LicenseCertificate,
                        j.ExperienceYears,
                        j.SelfDeclaredWeight,
                        j.BloodType,
                        j.HealthStatus,
                        j.Status,
                        u.PhoneNumber,
                        u.DateOfBirth,
                        Certificate = certificate
                    })
                .FirstOrDefaultAsync(),

            // Schema v2: PhoneNumber + DateOfBirth + IdentityNumber đã chuyển sang Users.
            // Profile Owner chỉ còn OwnerId — trả về từ Users context.
            "Owner" => await _context.Users
                .AsNoTracking()
                .Where(u => u.UserId == userId)
                .Select(u => new {
                    u.PhoneNumber,
                    u.DateOfBirth,
                    // IdentityNumber KHÔNG trả ra API (encrypted, restricted)
                    HasIdentity = u.IdentityHash != null
                })
                .FirstOrDefaultAsync(),

            "Referee" => await _context.RefereeProfiles
                .AsNoTracking()
                .Where(r => r.RefereeId == userId)
                .Join(_context.Users.AsNoTracking(),
                    r => r.RefereeId, u => u.UserId,
                    (r, u) => new {
                        r.CertificationLevel,
                        r.Status,
                        u.PhoneNumber,
                        u.DateOfBirth,
                        Certificate = certificate
                    })
                .FirstOrDefaultAsync(),

            "Doctor" => await _context.DoctorProfiles
                .AsNoTracking()
                .Where(d => d.DoctorId == userId)
                .Join(_context.Users.AsNoTracking(),
                    d => d.DoctorId, u => u.UserId,
                    (d, u) => new {
                        d.MedicalLicenseNumber,
                        d.Status,
                        u.PhoneNumber,
                        u.DateOfBirth,
                        Certificate = certificate
                    })
                .FirstOrDefaultAsync(),

            "Spectator" => await _context.Wallets
                .AsNoTracking()
                .Where(w => w.SpectatorId == userId)
                .Select(w => new { w.Balance })
                .FirstOrDefaultAsync(),

            _ => null
        };
    }
}