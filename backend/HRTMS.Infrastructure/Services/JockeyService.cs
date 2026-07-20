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
    private readonly INotificationService _notificationService;
    private readonly ITokenBlacklistService _tokenBlacklistService;

    public JockeyService(
        HRTMSDbContext context,
        INotificationService notificationService,
        ITokenBlacklistService tokenBlacklistService)
    {
        _context = context;
        _notificationService = notificationService;
        _tokenBlacklistService = tokenBlacklistService;
    }

    public async Task<JockeyProfileDto?> GetProfileAsync(int jockeyId)
    {
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
                PhoneNumber = j.Jockey.PhoneNumber,
                DateOfBirth = j.Jockey.DateOfBirth,
                CreatedAt = j.CreatedAt
            })
            .FirstOrDefaultAsync();
    }

    public async Task<JockeyProfileDto?> UpdateProfileAsync(
        int jockeyId,
        UpdateJockeyProfileDto dto)
    {
        var jockey = await _context.JockeyProfiles
            .Include(j => j.Jockey)
            .FirstOrDefaultAsync(j => j.JockeyId == jockeyId);

        if (jockey == null)
        {
            return null;
        }

        var oldLicense = jockey.LicenseCertificate;
        var oldStatus = jockey.Status;
        var oldSelfDeclaredWeight = jockey.SelfDeclaredWeight;
        var oldBloodType = jockey.BloodType;
        var oldHealthStatus = jockey.HealthStatus;
        var licenseChanged = false;

        if (!string.IsNullOrWhiteSpace(dto.LicenseCertificate))
        {
            var normalizedLicense = dto.LicenseCertificate.Trim();

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

                // License la credential duoc Admin duyet - doi license phai
                // re-trigger approval, khong duoc giu nguyen Status cu (dong bo
                // pattern HRS.6 cua Horse: sua field nhay cam -> ve Pending).
                jockey.Status = "Pending";
                jockey.RejectionReason = null;

                // BUGFIX: JockeyProfile.Status va Users.Status phai dong bo.
                // Truoc day chi doi JockeyProfile.Status -> user van Users.Status
                // = "Active" nen van dang nhap/dung he thong binh thuong du UI
                // hien "Pending". Doi ca Users.Status de login/authorization thuc
                // su bi chan cho toi khi Admin duyet lai (giong pattern ApproveJockey
                // set ca profile.Status va user.Status = "Active").
                if (jockey.Jockey != null)
                {
                    jockey.Jockey.Status = "Pending";
                    jockey.Jockey.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        if (dto.SelfDeclaredWeight.HasValue)
        {
            jockey.SelfDeclaredWeight =
                dto.SelfDeclaredWeight.Value;
        }

        if (dto.BloodType != null)
        {
            jockey.BloodType = string.IsNullOrWhiteSpace(dto.BloodType)
                ? null
                : dto.BloodType.Trim();
        }

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

        var anyChanged = licenseChanged ||
            oldSelfDeclaredWeight != jockey.SelfDeclaredWeight ||
            oldBloodType != jockey.BloodType ||
            oldHealthStatus != jockey.HealthStatus;

        if (anyChanged)
        {
            jockey.Status = "Pending";
            jockey.RejectionReason = null;

            if (jockey.Jockey != null)
            {
                jockey.Jockey.Status = "Pending";
                jockey.Jockey.UpdatedAt = DateTime.UtcNow;
            }

            _context.AuditLogs.Add(new AuditLog
            {
                ActorId = jockeyId,
                Action = licenseChanged ? "Update_Jockey_License" : "Update_Jockey_Profile",
                EntityName = "JockeyProfiles",
                EntityId = jockeyId.ToString(),
                OldValue = JsonSerializer.Serialize(new
                {
                    LicenseCertificate = oldLicense,
                    Status = oldStatus,
                    SelfDeclaredWeight = oldSelfDeclaredWeight,
                    BloodType = oldBloodType,
                    HealthStatus = oldHealthStatus
                }),
                NewValue = JsonSerializer.Serialize(new
                {
                    LicenseCertificate = jockey.LicenseCertificate,
                    jockey.Status,
                    jockey.SelfDeclaredWeight,
                    jockey.BloodType,
                    jockey.HealthStatus
                }),
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        if (anyChanged)
        {
            await _tokenBlacklistService.BlacklistUserAsync(jockeyId);

            await _notificationService.SendAsync(
                jockeyId,
                "Hồ sơ Jockey đang chờ duyệt lại",
                "Bạn vừa cập nhật thông tin hồ sơ. Hồ sơ của bạn đã được chuyển về " +
                "trạng thái chờ duyệt (Pending) cho tới khi Admin phê duyệt lại. " +
                "Vui lòng đăng nhập lại sau khi hồ sơ được phê duyệt.",
                type: "Both",
                relatedEntityType: "JockeyProfiles",
                relatedEntityId: jockeyId);
        }

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
            PhoneNumber = jockey.Jockey.PhoneNumber,
            DateOfBirth = jockey.Jockey.DateOfBirth,
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

        var ownerHorseIds = await _context.Horses
            .Where(h => h.OwnerId == ownerId)
            .Select(h => h.HorseId)
            .ToListAsync();

        var pendingJockeyIds = await _context.Pairings
            .Where(p =>
                ownerHorseIds.Contains(p.HorseId) &&
                p.Status == "Pending")
            .Select(p => p.JockeyId)
            .ToListAsync();

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
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        var validStatuses = new[]
        {
            "Pending",
            "Accepted",
            "Declined"
        };

        if (!string.IsNullOrWhiteSpace(status) &&
            !validStatuses.Contains(status))
        {
            throw new ArgumentException(
                "INVALID_PAIRING_STATUS");
        }

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
                CreatedAt = p.CreatedAt,
                RespondedAt = p.Status != "Pending" ? p.UpdatedAt : (DateTime?)null
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
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        var validStatuses = new[]
        {
        "Pending",
        "Confirmed",
        "Cancelled",
        "Disqualified"
    };

        if (!string.IsNullOrWhiteSpace(status) &&
            !validStatuses.Contains(status))
        {
            throw new ArgumentException(
                "INVALID_RACE_ENTRY_STATUS");
        }

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
    public async Task<JockeyCareerStatsDto> GetCareerStatsAsync(int jockeyId)
    {
        // Chi tinh tren RaceEntry cua race da co ket qua chinh thuc (Official)
        // va khong bi rut lui giua chung (IsWithdrawn) — FinishPosition/Points/Earnings
        // cua entry rut lui khong phan anh dung phong do thi dau.
        var jockey = await _context.JockeyProfiles
            .Include(j => j.Jockey)
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.JockeyId == jockeyId);

        if (jockey == null)
        {
            throw new KeyNotFoundException("JOCKEY_NOT_FOUND");
        }

        var officialEntries = await _context.RaceEntries
            .AsNoTracking()
            .Where(re =>
                re.Pairing.JockeyId == jockeyId &&
                re.Race.Status == "Official" &&
                !re.IsWithdrawn)
            .Select(re => new
            {
                re.FinishPosition,
                re.PointsAwarded,
                re.EarningsAwarded
            })
            .ToListAsync();

        var totalRaces = officialEntries.Count;
        var wins = officialEntries.Count(e => e.FinishPosition == 1);
        var podiums = officialEntries.Count(e => e.FinishPosition is >= 1 and <= 3);

        return new JockeyCareerStatsDto
        {
            JockeyId = jockeyId,
            FullName = jockey.Jockey.FullName,

            TotalRaces = totalRaces,
            Wins = wins,
            Podiums = podiums,

            WinRate = totalRaces > 0
                ? Math.Round(wins * 100.0 / totalRaces, 2)
                : null,
            PodiumRate = totalRaces > 0
                ? Math.Round(podiums * 100.0 / totalRaces, 2)
                : null,

            AverageFinishPosition = totalRaces > 0 &&
                officialEntries.Any(e => e.FinishPosition.HasValue)
                ? Math.Round(
                    officialEntries
                        .Where(e => e.FinishPosition.HasValue)
                        .Average(e => (double)e.FinishPosition!.Value),
                    2)
                : null,

            TotalPoints = officialEntries.Sum(e => e.PointsAwarded ?? 0),
            TotalEarnings = officialEntries.Sum(e => e.EarningsAwarded ?? 0)
        };
    }
}