using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class ProfileService : IProfileService
{
    private readonly HRTMSDbContext _context;

    public ProfileService(HRTMSDbContext context)
    {
        _context = context;
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