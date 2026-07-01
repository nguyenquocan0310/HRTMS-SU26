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
        if (page <= 0)
        {
            page = 1;
        }

        if (pageSize <= 0)
        {
            pageSize = 20;
        }

        var tournament = await _context.Tournaments
            .FirstOrDefaultAsync(t => t.TournamentId == tournamentId);

        if (tournament == null)
        {
            throw new KeyNotFoundException("TOURNAMENT_NOT_FOUND");
        }

        // Lay danh sach HorseId cua Owner dang dang nhap
        var ownerHorseIds = await _context.Horses
            .Where(h => h.OwnerId == ownerId)
            .Select(h => h.HorseId)
            .ToListAsync();

        // Lay danh sach Jockey da co pending invite tu Owner nay
        var pendingJockeyIds = await _context.Pairings
            .Where(p =>
                ownerHorseIds.Contains(p.HorseId) &&
                p.Status == "Pending")
            .Select(p => p.JockeyId)
            .ToListAsync();

        // Chi jockey co trong roster Approved cua giai moi duoc hien thi
        var rosterJockeyIds = await _context.TournamentParticipants
            .Where(p =>
                p.TournamentId == tournamentId &&
                p.Role == "Jockey" &&
                p.Status == "Approved")
            .Select(p => p.UserId)
            .ToListAsync();

        var query = _context.JockeyProfiles
            .Include(j => j.Jockey)
            .Where(j =>
                j.Status == "Active" &&
                j.ExperienceYears >= tournament.MinJockeyExperienceYears &&
                rosterJockeyIds.Contains(j.JockeyId) &&
                !pendingJockeyIds.Contains(j.JockeyId));

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(j => j.ExperienceYears)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(j => new AvailableJockeyDto
            {
                JockeyId = j.JockeyId,
                FullName = j.Jockey.FullName,
                LicenseCertificate = j.LicenseCertificate,
                ExperienceYears = j.ExperienceYears,
                HealthStatus = j.HealthStatus
            })
            .ToListAsync();

        return new PagedResult<AvailableJockeyDto>
        {
            Items = data,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
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
            Items = data,
            Page = page,
            PageSize = pageSize,
            TotalCount = total,
        };
    }
    public async Task<PagedResult<JockeyRaceEntryDto>>
    GetMyRaceEntriesAsync(
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
        "Confirmed",
        "Cancelled",
        "Disqualified"
    };

    // Kiem tra trang thai RaceEntry hop le neu client co filter
    if (!string.IsNullOrWhiteSpace(status) &&
        !validStatuses.Contains(status))
    {
        throw new ArgumentException(
            "INVALID_RACE_ENTRY_STATUS");
    }

    // Lay danh sach race entry cua Jockey dang dang nhap
    // RaceEntries -> Pairings -> JockeyId = current user id
    var query = _context.RaceEntries
        .AsNoTracking()
        .Where(re => re.Pairing.JockeyId == jockeyId);

    if (!string.IsNullOrWhiteSpace(status))
    {
        query = query.Where(re => re.Status == status);
    }

    var total = await query.CountAsync();

    var data = await query
        .OrderByDescending(re => re.Race.ScheduledTime)
        .ThenByDescending(re => re.RaceEntryId)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(re => new JockeyRaceEntryDto
        {
            RaceEntryId = re.RaceEntryId,
            RaceId = re.RaceId,
            PairingId = re.PairingId,

            TournamentId = re.Race.Round.TournamentId,
            TournamentName = re.Race.Round.Tournament.Name,

            RoundId = re.Race.RoundId,
            RoundName = re.Race.Round.Name,

            RaceNumber = re.Race.RaceNumber,
            ScheduledTime = re.Race.ScheduledTime,
            RaceStatus = re.Race.Status,
            EntryStatus = re.Status,
            PostPosition = re.PostPosition,

            HorseId = re.Pairing.HorseId,
            HorseName = re.Pairing.Horse.Name,

            OwnerId = re.Pairing.Horse.OwnerId,
            OwnerName = re.Pairing.Horse.Owner.Owner.FullName,

            PairingStatus = re.Pairing.Status,

            PreRaceJockeyWeight = re.PreRaceJockeyWeight,
            HorseIdentityCheckStatus = re.HorseIdentityCheckStatus,
            ClinicalStatus = re.ClinicalStatus,
            IndependenceCheckStatus = re.IndependenceCheckStatus,
            PostRaceJockeyWeight = re.PostRaceJockeyWeight,

            FinishPosition = re.FinishPosition,
            FinishTime = re.FinishTime,
            PointsAwarded = re.PointsAwarded,
            EarningsAwarded = re.EarningsAwarded,

            EntryFeeStatus = re.EntryFeeStatus,
            IsWithdrawn = re.IsWithdrawn,
            CreatedAt = re.CreatedAt,
            UpdatedAt = re.UpdatedAt
        })
        .ToListAsync();

    return new PagedResult<JockeyRaceEntryDto>
    {
        Items = data,
        Page = page,
        PageSize = pageSize,
        TotalCount = total
    };
}
}