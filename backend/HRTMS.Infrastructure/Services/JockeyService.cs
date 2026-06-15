using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Jockey;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HRTMS.Infrastructure.Services;

public class JockeyService : IJockeyService
{
    private readonly HRTMSDbContext _context;

    public JockeyService(HRTMSDbContext context)
    {
        _context = context;
    }

    public async Task<JockeyProfileDto?> GetProfileAsync(int jockeyId)
    {
        // Lay thong tin profile cua Jockey theo JockeyId
        return await _context.JockeyProfiles
            .AsNoTracking()
            .Where(j => j.JockeyId == jockeyId)
            .Select(j => new JockeyProfileDto
            {
                JockeyId = j.JockeyId,
                Username = j.Jockey.Username,
                FullName = j.Jockey.FullName,
                Email = j.Jockey.Email,
                LicenseCertificate = j.LicenseCertificate,
                ExperienceYears = j.ExperienceYears,
                SelfDeclaredWeight = j.SelfDeclaredWeight,
                BloodType = j.BloodType,
                HealthStatus = j.HealthStatus,
                Status = j.Status,
                CreatedAt = j.CreatedAt
            })
            .FirstOrDefaultAsync();
    }

    public async Task<JockeyProfileDto?> UpdateProfileAsync(
        int jockeyId,
        UpdateJockeyProfileDto dto)
    {
        // Lay profile Jockey kem thong tin User
        var jockey = await _context.JockeyProfiles
            .Include(j => j.Jockey)
            .FirstOrDefaultAsync(j => j.JockeyId == jockeyId);

        if (jockey == null)
        {
            return null;
        }

        var oldLicense = jockey.LicenseCertificate;
        var licenseChanged = false;

        // Chi cap nhat license khi client co gui gia tri moi
        if (!string.IsNullOrWhiteSpace(dto.LicenseCertificate))
        {
            var normalizedLicense = dto.LicenseCertificate.Trim();

            // Kiem tra license da duoc Jockey khac su dung hay chua
            var licenseExists = await _context.JockeyProfiles
                .AnyAsync(j =>
                    j.JockeyId != jockeyId &&
                    j.LicenseCertificate == normalizedLicense);

            if (licenseExists)
            {
                throw new InvalidOperationException(
                    "LICENSE_ALREADY_EXISTS");
            }

            if (jockey.LicenseCertificate != normalizedLicense)
            {
                jockey.LicenseCertificate = normalizedLicense;
                licenseChanged = true;
            }
        }

        // Cap nhat can nang tu khai neu co gui len
        if (dto.SelfDeclaredWeight.HasValue)
        {
            jockey.SelfDeclaredWeight =
                dto.SelfDeclaredWeight.Value;
        }

        // Cap nhat nhom mau neu co gui len
        if (dto.BloodType != null)
        {
            jockey.BloodType = string.IsNullOrWhiteSpace(dto.BloodType)
                ? null
                : dto.BloodType.Trim();
        }

        // Cap nhat tinh trang suc khoe neu co gui len
        if (dto.HealthStatus != null)
        {
            var validHealthStatuses = new[]
            {
                "Good",
                "Fair",
                "Under Treatment"
            };

            if (!validHealthStatuses.Contains(dto.HealthStatus))
            {
                throw new ArgumentException(
                    "INVALID_HEALTH_STATUS");
            }

            jockey.HealthStatus = dto.HealthStatus;
        }

        jockey.UpdatedAt = DateTime.UtcNow;

        // Neu license thay doi thi ghi AuditLog
        if (licenseChanged)
        {
            _context.AuditLogs.Add(new AuditLog
            {
                ActorId = jockeyId,
                Action = "Update_Jockey_License",
                EntityName = "JockeyProfiles",
                EntityId = jockeyId.ToString(),
                OldValue = JsonSerializer.Serialize(new
                {
                    LicenseCertificate = oldLicense
                }),
                NewValue = JsonSerializer.Serialize(new
                {
                    LicenseCertificate =
                        jockey.LicenseCertificate
                }),
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        // Tra ve profile sau khi cap nhat
        return new JockeyProfileDto
        {
            JockeyId = jockey.JockeyId,
            Username = jockey.Jockey.Username,
            FullName = jockey.Jockey.FullName,
            Email = jockey.Jockey.Email,
            LicenseCertificate = jockey.LicenseCertificate,
            ExperienceYears = jockey.ExperienceYears,
            SelfDeclaredWeight = jockey.SelfDeclaredWeight,
            BloodType = jockey.BloodType,
            HealthStatus = jockey.HealthStatus,
            Status = jockey.Status,
            CreatedAt = jockey.CreatedAt
        };
    }

    public async Task<PagedResult<AvailableJockeyDto>>
        GetAvailableAsync(
            int ownerId,
            int tournamentId,
            int page,
            int pageSize)
    {
        // Chuan hoa gia tri phan trang
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        // Kiem tra Tournament co ton tai hay khong
        var tournament = await _context.Tournaments
            .AsNoTracking()
            .FirstOrDefaultAsync(t =>
                t.TournamentId == tournamentId);

        if (tournament == null)
        {
            throw new KeyNotFoundException(
                "TOURNAMENT_NOT_FOUND");
        }

        // Chi lay Jockey Active, du kinh nghiem va chua co loi moi Pending tu Owner nay
        var query = _context.JockeyProfiles
            .AsNoTracking()
            .Where(j =>
                j.Status == "Active" &&
                j.ExperienceYears >=
                    tournament.MinJockeyExperienceYears &&
                !_context.Pairings.Any(p =>
                    p.JockeyId == j.JockeyId &&
                    p.Horse.OwnerId == ownerId &&
                    p.Status == "Pending"));

        var total = await query.CountAsync();

        var data = await query
            .OrderBy(j => j.Jockey.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(j => new AvailableJockeyDto
            {
                JockeyId = j.JockeyId,
                FullName = j.Jockey.FullName,
                LicenseCertificate =
                    j.LicenseCertificate,
                ExperienceYears = j.ExperienceYears,
                HealthStatus = j.HealthStatus
            })
            .ToListAsync();

        return new PagedResult<AvailableJockeyDto>
        {
            Data = data,
            Page = page,
            PageSize = pageSize,
            Total = total,
            TotalPages = (int)Math.Ceiling(
                total / (double)pageSize)
        };
    }

    public async Task<PagedResult<JockeyInvitationDto>>
        GetInvitationsAsync(
            int jockeyId,
            string? status,
            int page,
            int pageSize)
    {
        // Chuan hoa gia tri phan trang
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        var validStatuses = new[]
        {
            "Pending",
            "Accepted",
            "Declined"
        };

        // Kiem tra trang thai Pairing hop le
        if (!string.IsNullOrWhiteSpace(status) &&
            !validStatuses.Contains(status))
        {
            throw new ArgumentException(
                "INVALID_PAIRING_STATUS");
        }

        // Lay danh sach loi moi cua Jockey dang dang nhap
        var query = _context.Pairings
            .AsNoTracking()
            .Where(p => p.JockeyId == jockeyId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(p => p.Status == status);
        }

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new JockeyInvitationDto
            {
                PairingId = p.PairingId,

                Horse = new InvitationHorseDto
                {
                    HorseId = p.Horse.HorseId,
                    Name = p.Horse.Name,
                    Breed = p.Horse.Breed
                },

                Owner = new InvitationOwnerDto
                {
                    OwnerId = p.Horse.OwnerId,
                    FullName = p.Horse.Owner.Owner.FullName
                },

                RequestMessage = p.RequestMessage,
                Status = p.Status,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return new PagedResult<JockeyInvitationDto>
        {
            Data = data,
            Page = page,
            PageSize = pageSize,
            Total = total,
            TotalPages = (int)Math.Ceiling(
                total / (double)pageSize)
        };
    }
}