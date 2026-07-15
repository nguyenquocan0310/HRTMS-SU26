using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Jockey;
using HRTMS.Core.DTOs.Pairing;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class PairingService : IPairingService
{
    private readonly HRTMSDbContext _context;
    private readonly INotificationService _notification;

    public PairingService(HRTMSDbContext context, INotificationService notification)
    {
        _context = context;
        _notification = notification;
    }

    public async Task<PairingResponseDto> CreateAsync(
        int ownerId,
        CreatePairingDto dto)
    {
        // Lay thong tin ngua theo HorseId
        var horse = await _context.Horses
            .FirstOrDefaultAsync(h => h.HorseId == dto.HorseId);

        if (horse == null)
        {
            throw new KeyNotFoundException("HORSE_NOT_FOUND");
        }

        // Kiem tra ngua co thuoc Owner dang dang nhap hay khong
        if (horse.OwnerId != ownerId)
        {
            throw new UnauthorizedAccessException("HORSE_NOT_OWNED");
        }

        // Schema v3: ngua phai da enroll (va duoc duyet) trong dung tournament cua request.
        // Horse khong con gan TournamentId truc tiep — kiem tra qua HorseTournamentEntries.
        var enrollment = await _context.HorseTournamentEntries
            .FirstOrDefaultAsync(e =>
                e.HorseId == dto.HorseId &&
                e.TournamentId == dto.TournamentId);

        if (enrollment == null || enrollment.Status != "Enrolled")
        {
            throw new InvalidOperationException("HORSE_NOT_IN_TOURNAMENT");
        }

        // Chi ngua da duoc duyet enrollment trong giai nay moi duoc gui loi moi ghep cap
        if (enrollment.AdminApprovalStatus != "Approved")
        {
            throw new InvalidOperationException("HORSE_NOT_APPROVED");
        }

        // Lay thong tin tournament de check kinh nghiem toi thieu
        var tournament = await _context.Tournaments
            .FirstOrDefaultAsync(t => t.TournamentId == dto.TournamentId);

        if (tournament == null)
        {
            throw new KeyNotFoundException("TOURNAMENT_NOT_FOUND");
        }

        // Lay thong tin Jockey
        var jockey = await _context.JockeyProfiles
            .Include(j => j.Jockey)
            .FirstOrDefaultAsync(j => j.JockeyId == dto.JockeyId);

        if (jockey == null)
        {
            throw new KeyNotFoundException("JOCKEY_NOT_FOUND");
        }

        // Chi Jockey Active moi duoc nhan loi moi
        if (jockey.Status != "Active")
        {
            throw new InvalidOperationException("JOCKEY_NOT_ACTIVE");
        }

        // Check kinh nghiem toi thieu cua giai dau
        if (jockey.ExperienceYears < tournament.MinJockeyExperienceYears)
        {
            throw new InvalidOperationException("JOCKEY_EXPERIENCE_TOO_LOW");
        }

        // Jockey phai dang ky tham gia tournament va da duoc duyet roster
        var jockeyParticipant = await _context.TournamentParticipants
            .FirstOrDefaultAsync(tp =>
                tp.TournamentId == dto.TournamentId &&
                tp.UserId == dto.JockeyId &&
                tp.Role == "Jockey");

        if (jockeyParticipant == null)
        {
            throw new InvalidOperationException(
                "JOCKEY_NOT_REGISTERED_IN_TOURNAMENT");
        }

        if (jockeyParticipant.Status != "Approved")
        {
            throw new InvalidOperationException(
                "JOCKEY_NOT_APPROVED_IN_TOURNAMENT");
        }
        // Kiem tra Jockey da co cap Accepted/Confirmed trong cung giai
        // hoac trong tournament khac bi trung thoi gian voi giai hien tai hay chua
        var overlappingTournamentIds = await _context.Tournaments
            .AsNoTracking()
            .Where(t =>
                t.TournamentId == dto.TournamentId ||
                (
                    t.StartDate <= tournament.EndDate &&
                    t.EndDate >= tournament.StartDate
                ))
            .Select(t => t.TournamentId)
            .ToListAsync();

        var jockeyAlreadyHasActivePairing = await _context.Pairings
            .AsNoTracking()
            .AnyAsync(p =>
                p.JockeyId == dto.JockeyId &&
                overlappingTournamentIds.Contains(p.TournamentId) &&
                (
                    p.Status == "Accepted" ||
                    p.Status == "Confirmed"
                ));

        if (jockeyAlreadyHasActivePairing)
        {
            throw new InvalidOperationException("JOCKEY_ALREADY_HAS_ACTIVE_PAIRING");
        }

        // Khong cho tao trung cung mot cap horse-jockey trong cung tournament
        // neu dang Pending, Accepted hoac Confirmed
        var pairingExists = await _context.Pairings
            .AnyAsync(p =>
                p.TournamentId == dto.TournamentId &&
                p.HorseId == dto.HorseId &&
                p.JockeyId == dto.JockeyId &&
                (
                    p.Status == "Pending" ||
                    p.Status == "Accepted" ||
                    p.Status == "Confirmed"
                ));

        if (pairingExists)
        {
            throw new InvalidOperationException("PAIRING_ALREADY_EXISTS");
        }

        var now = DateTime.UtcNow;

        var pairing = new Pairing
        {
            TournamentId = dto.TournamentId,
            HorseId = dto.HorseId,
            JockeyId = dto.JockeyId,
            Status = "Pending",
            RequestMessage = dto.RequestMessage,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Pairings.Add(pairing);
        await _context.SaveChangesAsync();

        var messagePart = string.IsNullOrWhiteSpace(dto.RequestMessage)
            ? ""
            : $" Lời nhắn từ chủ ngựa: \"{dto.RequestMessage}\"";


        // Tao thong bao cho Jockey khi co loi moi moi (email — SRS Module O)
        await _notification.SendAsync(
            dto.JockeyId,
            "Lời mời ghép cặp thi đấu",
            $"Bạn nhận được lời mời ghép cặp thi đấu cùng ngựa '{horse.Name}'. Vui lòng phản hồi lời mời.{messagePart}",
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairing.PairingId);

        return new PairingResponseDto
        {
            PairingId = pairing.PairingId,
            TournamentId = pairing.TournamentId,
            HorseId = pairing.HorseId,
            JockeyId = pairing.JockeyId,
            Status = pairing.Status,
            CreatedAt = pairing.CreatedAt
        };

    }

    public async Task<PairingActionResponseDto> AcceptAsync(
        int jockeyId,
        int pairingId)
    {
        // Jockey accept chi doi Pending -> Accepted
        // Owner se confirm sau de thanh Confirmed
        var pairing = await _context.Pairings
            .Include(p => p.Horse)
            .FirstOrDefaultAsync(p => p.PairingId == pairingId);

        if (pairing == null)
        {
            throw new KeyNotFoundException("PAIRING_NOT_FOUND");
        }

        if (pairing.JockeyId != jockeyId)
        {
            throw new UnauthorizedAccessException("FORBIDDEN");
        }

        if (pairing.Status != "Pending")
        {
            throw new InvalidOperationException("INVALID_STATUS");
        }

        if (pairing.Horse.AdminApprovalStatus != "Approved")
        {
            throw new InvalidOperationException("HORSE_NOT_APPROVED");
        }

        pairing.Status = "Accepted";
        pairing.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Gui thong bao cho Owner de vao xac nhan cuoi cung (email + in-app)
        await _notification.SendAsync(
            pairing.Horse.OwnerId,
            "Nài ngựa đã chấp nhận lời mời",
            $"Nài ngựa đã chấp nhận ghép cặp cùng ngựa '{pairing.Horse.Name}'. Vui lòng xác nhận cặp thi đấu.",
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairing.PairingId);

        return new PairingActionResponseDto
        {
            PairingId = pairing.PairingId,
            Status = pairing.Status,
            Message =
                "Đã chấp nhận lời mời ghép cặp. Đang chờ chủ ngựa xác nhận."
        };
    }

    public async Task<PairingActionResponseDto> ConfirmAsync(
     int ownerId,
     int pairingId)
    {
        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        var pairing = await _context.Pairings
            .Include(p => p.Horse)
            .Include(p => p.Jockey)
            .FirstOrDefaultAsync(p => p.PairingId == pairingId);

        if (pairing == null)
        {
            throw new KeyNotFoundException("PAIRING_NOT_FOUND");
        }

        if (pairing.Horse.OwnerId != ownerId)
        {
            throw new UnauthorizedAccessException("FORBIDDEN");
        }

        if (pairing.Status != "Accepted")
        {
            throw new InvalidOperationException("INVALID_STATUS");
        }

        if (pairing.Horse.AdminApprovalStatus != "Approved")
        {
            throw new InvalidOperationException("HORSE_NOT_APPROVED");
        }

        if (pairing.Jockey.Status != "Active")
        {
            throw new InvalidOperationException("JOCKEY_NOT_ACTIVE");
        }

        var jockeyParticipant = await _context.TournamentParticipants
            .FirstOrDefaultAsync(tp =>
                tp.TournamentId == pairing.TournamentId &&
                tp.UserId == pairing.JockeyId &&
                tp.Role == "Jockey");

        if (jockeyParticipant == null)
        {
            throw new InvalidOperationException(
                "JOCKEY_NOT_REGISTERED_IN_TOURNAMENT");
        }

        if (jockeyParticipant.Status != "Approved")
        {
            throw new InvalidOperationException(
                "JOCKEY_NOT_APPROVED_IN_TOURNAMENT");
        }

        pairing.Status = "Confirmed";
        pairing.UpdatedAt = DateTime.UtcNow;

        var otherPairings = await _context.Pairings
            .Where(p =>
                p.TournamentId == pairing.TournamentId &&
                p.HorseId == pairing.HorseId &&
                p.PairingId != pairing.PairingId &&
                (
                    p.Status == "Pending" ||
                    p.Status == "Accepted"
                ))
            .ToListAsync();

        foreach (var otherPairing in otherPairings)
        {
            otherPairing.Status = "Cancelled";
            otherPairing.ResponseReason =
                "Owner confirmed another pairing for this horse.";
            otherPairing.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        // Gui thong bao cho Jockey sau khi commit (email + in-app)
        await _notification.SendAsync(
            pairing.JockeyId,
            "Cặp thi đấu đã được xác nhận",
            $"Chủ ngựa đã xác nhận cặp thi đấu của bạn cùng ngựa '{pairing.Horse.Name}'.",
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairing.PairingId);

        return new PairingActionResponseDto
        {
            PairingId = pairing.PairingId,
            Status = pairing.Status,
            Message = "Đã xác nhận cặp thi đấu thành công."
        };
    }

    public async Task<PairingActionResponseDto> DeclineAsync(
        int jockeyId,
        int pairingId,
        DeclinePairingDto dto)
    {
        // Lay Pairing kem thong tin ngua
        var pairing = await _context.Pairings
            .Include(p => p.Horse)
            .FirstOrDefaultAsync(p =>
                p.PairingId == pairingId);

        if (pairing == null)
        {
            throw new KeyNotFoundException("PAIRING_NOT_FOUND");
        }

        // Chi dung Jockey trong Pairing moi duoc tu choi
        if (pairing.JockeyId != jockeyId)
        {
            throw new UnauthorizedAccessException("FORBIDDEN");
        }

        // Chi Pairing Pending moi duoc tu choi
        if (pairing.Status != "Pending")
        {
            throw new InvalidOperationException("INVALID_STATUS");
        }

        pairing.Status = "Declined";
        pairing.ResponseReason = dto.ResponseReason;
        pairing.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var reasonPart = string.IsNullOrWhiteSpace(dto.ResponseReason)
            ? ""
            : $" Lý do: \"{dto.ResponseReason}\"";

        // Gui thong bao cho Owner (email)
        await _notification.SendAsync(
            pairing.Horse.OwnerId,
            "Nài ngựa đã từ chối lời mời",
            $"Nài ngựa đã từ chối ghép cặp cùng ngựa '{pairing.Horse.Name}'.{reasonPart}",
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairing.PairingId);

        return new PairingActionResponseDto
        {
            PairingId = pairing.PairingId,
            Status = pairing.Status,
            Message = "Đã từ chối lời mời ghép cặp."
        };
    }

    public async Task<PagedResult<OwnerPairingDto>>
        GetOwnerPairingsAsync(
            int ownerId,
            string? status,
            int? horseId,
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
            "Declined",
            "Confirmed",
            "Cancelled"
        };

        // Kiem tra trang thai Pairing hop le
        if (!string.IsNullOrWhiteSpace(status) &&
            !validStatuses.Contains(status))
        {
            throw new ArgumentException("INVALID_PAIRING_STATUS");
        }

        // Lay danh sach Pairing cua Owner dang dang nhap
        var query = _context.Pairings
            .AsNoTracking()
            .Where(p => p.Horse.OwnerId == ownerId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(p => p.Status == status);
        }

        if (horseId.HasValue)
        {
            query = query.Where(p =>
                p.HorseId == horseId.Value);
        }

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new OwnerPairingDto
            {
                PairingId = p.PairingId,
                TournamentId = p.TournamentId,

                Horse = new OwnerPairingHorseDto
                {
                    HorseId = p.Horse.HorseId,
                    Name = p.Horse.Name,
                    Breed = p.Horse.Breed
                },

                Jockey = new OwnerPairingJockeyDto
                {
                    JockeyId = p.Jockey.JockeyId,
                    FullName = p.Jockey.Jockey.FullName,
                    LicenseCertificate = p.Jockey.LicenseCertificate,
                    ExperienceYears = p.Jockey.ExperienceYears
                },

                RequestMessage = p.RequestMessage,
                Status = p.Status,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return new PagedResult<OwnerPairingDto>
        {
            Items = data,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }
    public async Task<PagedResult<JockeyInvitationDto>> GetJockeyInvitationsAsync(
    int jockeyId,
    int page,
    int pageSize)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100)
        {
            throw new ArgumentException("INVALID_PAGING");
        }
        // Chuan hoa gia tri phan trang
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        // Lay danh sach loi moi Pending cua Jockey dang dang nhap
        // Dung join truc tiep de tranh phu thuoc navigation property cua Entity
        var query =
            from pairing in _context.Pairings.AsNoTracking()
            join horse in _context.Horses.AsNoTracking()
                on pairing.HorseId equals horse.HorseId
            join owner in _context.Users.AsNoTracking()
                on horse.OwnerId equals owner.UserId
            where pairing.JockeyId == jockeyId
                  && pairing.Status == "Pending"
            select new JockeyInvitationDto
            {
                PairingId = pairing.PairingId,

                Horse = new InvitationHorseDto
                {
                    HorseId = horse.HorseId,
                    Name = horse.Name,
                    Breed = horse.Breed
                },

                Owner = new InvitationOwnerDto
                {
                    OwnerId = owner.UserId,
                    FullName = owner.FullName
                },

                RequestMessage = pairing.RequestMessage,
                Status = pairing.Status,
                CreatedAt = pairing.CreatedAt
            };

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(i => i.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<JockeyInvitationDto>
        {
            Items = data,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<PagedResult<AdminPairingDto>> GetAdminPairingsAsync(
        int? tournamentId,
        string? status,
        bool unallocatedOnly,
        int page,
        int pageSize)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        // Mac dinh "Confirmed" — trang thai duy nhat duoc phep allocate (SCH.1).
        var effectiveStatus = string.IsNullOrWhiteSpace(status) ? "Confirmed" : status;

        var validStatuses = new[]
        {
            "Pending",
            "Accepted",
            "Declined",
            "Confirmed",
            "Cancelled"
        };

        if (!validStatuses.Contains(effectiveStatus))
        {
            throw new ArgumentException("INVALID_PAIRING_STATUS");
        }

        var query = _context.Pairings
            .AsNoTracking()
            .Where(p => p.Status == effectiveStatus);

        if (tournamentId.HasValue)
        {
            query = query.Where(p => p.TournamentId == tournamentId.Value);
        }

        // Chi giu pairing CHUA co RaceEntry active (Pending/Confirmed) trong race CHUA ket thuc.
        // Race da Official/Cancelled khong con "chiem cho" — pairing phai xuat hien lai
        // de Admin allocate vao round ke tiep (multi-round).
        if (unallocatedOnly)
        {
            query = query.Where(p =>
                !p.RaceEntries.Any(re =>
                    (re.Status == "Pending" || re.Status == "Confirmed") &&
                    re.Race.Status != "Official" &&
                    re.Race.Status != "Cancelled"));
        }

        var total = await query.CountAsync();

        var data = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new AdminPairingDto
            {
                PairingId = p.PairingId,
                TournamentId = p.TournamentId,
                TournamentName = p.Tournament.Name,
                HorseId = p.HorseId,
                HorseName = p.Horse.Name,
                HorseBreed = p.Horse.Breed,
                JockeyId = p.JockeyId,
                JockeyName = p.Jockey.Jockey.FullName,
                OwnerId = p.Horse.OwnerId,
                OwnerName = p.Horse.Owner.Owner.FullName,
                Status = p.Status,
                IsAllocated = p.RaceEntries.Any(re =>
                    (re.Status == "Pending" || re.Status == "Confirmed") &&
                    re.Race.Status != "Official" &&
                    re.Race.Status != "Cancelled"),
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return new PagedResult<AdminPairingDto>
        {
            Items = data,
            Page = page,
            PageSize = pageSize,
            TotalCount = total
        };
    }

    public async Task<PairingActionResponseDto> CancelAsync(
    int ownerId,
    int pairingId)
    {
        var pairing = await _context.Pairings
            .Include(p => p.Horse)
            .FirstOrDefaultAsync(p => p.PairingId == pairingId);

        if (pairing == null)
        {
            throw new KeyNotFoundException("PAIRING_NOT_FOUND");
        }

        // Chi Owner cua ngua moi duoc cancel loi moi
        if (pairing.Horse.OwnerId != ownerId)
        {
            throw new UnauthorizedAccessException("HORSE_NOT_OWNED");
        }

        // Chi cho cancel khi loi moi dang Pending hoac da Accepted nhung chua Confirmed
        if (pairing.Status != "Pending" &&
            pairing.Status != "Accepted")
        {
            throw new InvalidOperationException("INVALID_STATUS");
        }

        pairing.Status = "Cancelled";
        pairing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new PairingActionResponseDto
        {
            PairingId = pairing.PairingId,
            Status = pairing.Status,
            Message = "Đã hủy lời mời ghép cặp."
        };
    }
}