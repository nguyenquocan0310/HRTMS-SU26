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

    public ProfileService(HRTMSDbContext context, IAuditLogService auditLog)
    {
        _context = context;
        _auditLog = auditLog;
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

        await _auditLog.LogAsync(
            actorId: userId,
            action: "Update_Profile",
            entityName: "Users",
            entityId: userId.ToString(),
            oldValue: $"FullName={oldFullName}, Email={oldEmail}",
            newValue: $"FullName={user.FullName}, Email={user.Email}",
            ipAddress: ipAddress
        );

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
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: userId,
            action: "Change_Password",
            entityName: "Users",
            entityId: userId.ToString(),
            ipAddress: ipAddress
        );

        return ApiResponse<bool>.Ok(true, "Đổi mật khẩu thành công.");
    }

    // =========================================================
    // PRIVATE — profile mở rộng theo role
    // =========================================================
    private async Task<object?> GetRoleProfileAsync(int userId, string role)
    {
        return role switch
        {
            "Jockey" => await _context.JockeyProfiles
                .AsNoTracking()
                .Where(j => j.JockeyId == userId)
                .Select(j => new {
                    j.LicenseCertificate,
                    j.ExperienceYears,
                    j.SelfDeclaredWeight,
                    j.BloodType,
                    j.HealthStatus,
                    j.Status
                })
                .FirstOrDefaultAsync(),

            "Owner" => await _context.OwnerProfiles
                .AsNoTracking()
                .Where(o => o.OwnerId == userId)
                .Select(o => new {
                    o.PhoneNumber,
                    o.IdentityNumber
                })
                .FirstOrDefaultAsync(),

            "Referee" => await _context.RefereeProfiles
                .AsNoTracking()
                .Where(r => r.RefereeId == userId)
                .Select(r => new {
                    r.CertificationLevel,
                    r.Status
                })
                .FirstOrDefaultAsync(),

            "Doctor" => await _context.DoctorProfiles
                .AsNoTracking()
                .Where(d => d.DoctorId == userId)
                .Select(d => new {
                    d.MedicalLicenseNumber,
                    d.Status
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