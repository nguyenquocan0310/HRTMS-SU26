using HRTMS.Core.Common;
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

        // Chi ngua da duoc Admin phe duyet moi duoc ghep cap
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

        // Chan tao Pairing trung khi da co Pending hoac Accepted
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

        // Sau khi luu se co PairingId tu database
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

        // Chi dung Jockey trong Pairing moi duoc chap nhan
        if (pairing.JockeyId != jockeyId)
        {
            throw new UnauthorizedAccessException(
                "FORBIDDEN");
        }

        // Chi Pairing Pending moi duoc chap nhan
        if (pairing.Status != "Pending")
        {
            throw new InvalidOperationException(
                "INVALID_STATUS");
        }

        pairing.Status = "Accepted";
        pairing.UpdatedAt = DateTime.UtcNow;

        // Gui thong bao cho Owner
        _context.Notifications.Add(new Notification
        {
            RecipientId = pairing.Horse.OwnerId,
            Title = "Pairing invitation accepted",
            Message =
                $"The jockey accepted the pairing invitation for horse {pairing.Horse.Name}.",
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
            Data = data,
            Page = page,
            PageSize = pageSize,
            Total = total,
            TotalPages = (int)Math.Ceiling(
                total / (double)pageSize)
        };
    }
}