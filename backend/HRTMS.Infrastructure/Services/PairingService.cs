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

    public PairingService(HRTMSDbContext context)
    {
        _context = context;
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
            throw new KeyNotFoundException(
                "HORSE_NOT_FOUND");
        }

        // Kiem tra ngua co thuoc Owner dang dang nhap hay khong
        if (horse.OwnerId != ownerId)
        {
            throw new UnauthorizedAccessException(
                "HORSE_NOT_OWNED");
        }

        // Chi ngua da duoc Admin phe duyet moi duoc gui loi moi ghep cap
        if (horse.AdminApprovalStatus != "Approved")
        {
            throw new InvalidOperationException(
                "HORSE_NOT_APPROVED");
        }

        // Lay thong tin Jockey
        var jockey = await _context.JockeyProfiles
            .Include(j => j.Jockey)
            .FirstOrDefaultAsync(j =>
                j.JockeyId == dto.JockeyId);

        if (jockey == null)
        {
            throw new KeyNotFoundException(
                "JOCKEY_NOT_FOUND");
        }

        // Chi Jockey Active moi duoc nhan loi moi
        if (jockey.Status != "Active")
        {
            throw new InvalidOperationException(
                "JOCKEY_NOT_ACTIVE");
        }

        // Kiem tra horse da co cap chinh thuc chua
        // Neu horse da co pairing Accepted thi owner khong duoc gui them loi moi cho horse nay
        var horseAlreadyHasAcceptedPairing = await _context.Pairings
            .AnyAsync(p =>
                p.HorseId == dto.HorseId &&
                p.Status == "Accepted");

        if (horseAlreadyHasAcceptedPairing)
        {
            throw new InvalidOperationException(
                "HORSE_ALREADY_HAS_ACCEPTED_JOCKEY");
        }

        // Kiem tra jockey da co cap chinh thuc chua
        // Neu jockey da co pairing Accepted thi jockey khong duoc nhan them loi moi moi
        var jockeyAlreadyHasAcceptedPairing = await _context.Pairings
            .AnyAsync(p =>
                p.JockeyId == dto.JockeyId &&
                p.Status == "Accepted");

        if (jockeyAlreadyHasAcceptedPairing)
        {
            throw new InvalidOperationException(
                "JOCKEY_ALREADY_HAS_ACCEPTED_HORSE");
        }

        // Kiem tra trung loi moi cho cung cap horse-jockey
        // Cho phep horse co nhieu pending voi jockey khac
        // Cho phep jockey co nhieu pending voi horse khac
        // Nhung khong cho tao trung cung mot cap horse-jockey
        var pairingExists = await _context.Pairings
            .AnyAsync(p =>
                p.HorseId == dto.HorseId &&
                p.JockeyId == dto.JockeyId &&
                (p.Status == "Pending" ||
                 p.Status == "Accepted"));

        if (pairingExists)
        {
            throw new InvalidOperationException(
                "PAIRING_ALREADY_EXISTS");
        }

        var now = DateTime.UtcNow;

        var pairing = new Pairing
        {
            HorseId = dto.HorseId,
            JockeyId = dto.JockeyId,
            Status = "Pending",
            RequestMessage = dto.RequestMessage,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Pairings.Add(pairing);

        // Tao thong bao cho Jockey khi co loi moi moi
        var notification = new Notification
        {
            RecipientId = dto.JockeyId,
            Title = "New pairing invitation",
            Message =
                $"You have received a pairing invitation for horse {horse.Name}.",
            Type = "In-app",
            RelatedEntityType = "Pairing",
            SentAt = now
        };

        _context.Notifications.Add(notification);

        await _context.SaveChangesAsync();

        // Sau khi luu pairing moi co PairingId tu database
        notification.RelatedEntityId = pairing.PairingId;

        await _context.SaveChangesAsync();

        return new PairingResponseDto
        {
            PairingId = pairing.PairingId,
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
        await using var transaction =
            await _context.Database.BeginTransactionAsync();

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

        var hasAcceptedPairingForHorse = await _context.Pairings
            .AnyAsync(p =>
                p.HorseId == pairing.HorseId &&
                p.PairingId != pairing.PairingId &&
                p.Status == "Accepted");

        if (hasAcceptedPairingForHorse)
        {
            throw new InvalidOperationException("HORSE_ALREADY_ACCEPTED");
        }

        // Chap nhan loi moi hien tai
        pairing.Status = "Accepted";
        pairing.UpdatedAt = DateTime.UtcNow;

        // Tu dong tu choi cac loi moi pending khac cua cung con ngua
        var otherPendingPairings = await _context.Pairings
            .Where(p =>
                p.HorseId == pairing.HorseId &&
                p.PairingId != pairing.PairingId &&
                p.Status == "Pending")
            .ToListAsync();

        foreach (var otherPairing in otherPendingPairings)
        {
            otherPairing.Status = "Declined";
            otherPairing.ResponseReason =
                "Another jockey has already accepted this horse invitation.";
            otherPairing.UpdatedAt = DateTime.UtcNow;
        }



        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return new PairingActionResponseDto
        {
            PairingId = pairing.PairingId,
            Status = pairing.Status,
            Message = "Pairing invitation accepted successfully."
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
            throw new KeyNotFoundException(
                "PAIRING_NOT_FOUND");
        }

        // Chi dung Jockey trong Pairing moi duoc tu choi
        if (pairing.JockeyId != jockeyId)
        {
            throw new UnauthorizedAccessException(
                "FORBIDDEN");
        }

        // Chi Pairing Pending moi duoc tu choi
        if (pairing.Status != "Pending")
        {
            throw new InvalidOperationException(
                "INVALID_STATUS");
        }

        pairing.Status = "Declined";
        pairing.ResponseReason = dto.ResponseReason;
        pairing.UpdatedAt = DateTime.UtcNow;

        // Gui thong bao cho Owner
        _context.Notifications.Add(new Notification
        {
            RecipientId = pairing.Horse.OwnerId,
            Title = "Pairing invitation declined",
            Message =
                $"The jockey declined the pairing invitation for horse {pairing.Horse.Name}.",
            Type = "In-app",
            RelatedEntityType = "Pairing",
            RelatedEntityId = pairing.PairingId,
            SentAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return new PairingActionResponseDto
        {
            PairingId = pairing.PairingId,
            Status = pairing.Status,
            Message = "Pairing invitation declined successfully."
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
            "Declined"
        };

        // Kiem tra trang thai Pairing hop le
        if (!string.IsNullOrWhiteSpace(status) &&
            !validStatuses.Contains(status))
        {
            throw new ArgumentException(
                "INVALID_PAIRING_STATUS");
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
                    LicenseCertificate =
                        p.Jockey.LicenseCertificate,
                    ExperienceYears =
                        p.Jockey.ExperienceYears
                },

                Status = p.Status,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return new PagedResult<OwnerPairingDto>
        {
            Items = data,
            Page = page,
            PageSize = pageSize,
            TotalCount = total,
        };
    }
    public async Task<PagedResult<JockeyInvitationDto>> GetJockeyInvitationsAsync(
    int jockeyId,
    int page,
    int pageSize)
    {
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
}