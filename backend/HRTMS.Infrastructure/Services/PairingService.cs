using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Jockey;
using HRTMS.Core.DTOs.Pairing;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Data;

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

        // Bao vệ cả trường hợp hai request gửi đồng thời: các bước kiểm tra active/
        // duplicate và insert phải nằm trong cùng transaction serializable.
        await using var transaction = await _context.Database
            .BeginTransactionAsync(IsolationLevel.Serializable);

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
        await transaction.CommitAsync();

        var messagePart = string.IsNullOrWhiteSpace(dto.RequestMessage)
            ? ""
            : $" Lời nhắn từ chủ ngựa: {dto.RequestMessage}";


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
        // Giải có phí: Jockey accept -> Accepted, Owner nộp lệ phí rồi Admin đối chiếu.
        // Giải miễn phí: hệ thống xác nhận ngay, không phát sinh thao tác Owner thừa.
        var pairing = await _context.Pairings
            .Include(p => p.Horse)
            .Include(p => p.Tournament)
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

        // ConfirmAsync ghi EntryFeePayment Verified Amount=0 và hủy các pairing còn
        // treo của cùng ngựa. Dùng Horse.OwnerId nội bộ, không nhận ownerId từ client.
        if (pairing.Tournament.EntryFeeAmount == 0)
        {
            var autoConfirmed = await ConfirmAsync(pairing.Horse.OwnerId, pairingId);
            return new PairingActionResponseDto
            {
                PairingId = autoConfirmed.PairingId,
                Status = autoConfirmed.Status,
                Message = "Giải đấu không thu lệ phí. Cặp thi đấu đã được xác nhận tự động."
            };
        }

        // Gui thong bao cho Owner de vao xac nhan cuoi cung (email + in-app)
        await _notification.SendAsync(
            pairing.Horse.OwnerId,
            "Nài ngựa đã chấp nhận lời mời",
            $"Nài ngựa đã chấp nhận ghép cặp cùng ngựa '{pairing.Horse.Name}'. Vui lòng nộp lệ phí để Ban tổ chức đối chiếu.",
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairing.PairingId);

        return new PairingActionResponseDto
        {
            PairingId = pairing.PairingId,
            Status = pairing.Status,
            Message =
                "Đã chấp nhận lời mời ghép cặp. Đang chờ chủ ngựa nộp lệ phí."
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
            .Include(p => p.Tournament)
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

        // DEPRECATED (patch 013): Owner KHÔNG còn tự xác nhận cặp đấu ở giải có thu
        // phí — xác nhận nay đến từ việc Admin verify lệ phí
        // (EntryFeePaymentService.VerifyAsync). Chặn ở đây để không có hai đường
        // cùng đưa Pairing lên Confirmed, và để Owner không bypass thanh toán.
        // Giải miễn phí (EntryFeeAmount = 0) vẫn dùng endpoint này.
        if (pairing.Tournament.EntryFeeAmount != 0)
        {
            throw new InvalidOperationException("ENTRY_FEE_REQUIRED");
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

        // Giải miễn phí vẫn ghi một payment Verified (Amount = 0) để giữ MỘT nguồn
        // sự thật: "Pairing Confirmed <=> có payment Verified". Auto-allocate nhờ đó
        // chỉ kiểm tra một điều kiện, không phải rẽ nhánh theo giải free/có phí.
        var hasActivePayment = await _context.EntryFeePayments
            .AnyAsync(p => p.PairingId == pairingId &&
                           (p.Status == "PendingVerification" || p.Status == "Verified"));
        if (!hasActivePayment)
        {
            _context.EntryFeePayments.Add(new EntryFeePayment
            {
                PairingId = pairingId,
                Amount = 0,
                Method = "Cash",
                ReceiptNo = "FREE-ENTRY",
                Status = "Verified",
                SubmittedAt = pairing.UpdatedAt,
                VerifiedBy = ownerId,
                VerifiedAt = pairing.UpdatedAt
            });
        }

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
            : $" Lý do: {dto.ResponseReason}";

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
        int targetRaceId,
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

        // Allocation list phai biet Race dich. Khong duoc liet ke pairing chung
        // ca tournament vi round sau chi nhan pairing da qualify o round truoc.
        var targetRace = await _context.Races
            .AsNoTracking()
            .Include(r => r.Round)
            .FirstOrDefaultAsync(r => r.RaceId == targetRaceId)
            ?? throw new KeyNotFoundException("TARGET_RACE_NOT_FOUND");

        var targetTournamentId = targetRace.Round.TournamentId;
        var targetRoundId = targetRace.RoundId;
        if (tournamentId.HasValue && tournamentId.Value != targetTournamentId)
        {
            throw new ArgumentException("TARGET_RACE_TOURNAMENT_MISMATCH");
        }

        var previousRound = await _context.Rounds
            .AsNoTracking()
            .Where(r => r.TournamentId == targetTournamentId &&
                        r.SequenceOrder < targetRace.Round.SequenceOrder)
            .OrderByDescending(r => r.SequenceOrder)
            .FirstOrDefaultAsync();

        var previousRoundId = previousRound?.RoundId;

        var query = _context.Pairings
            .AsNoTracking()
            .Where(p => p.TournamentId == targetTournamentId && p.Status == effectiveStatus);

        // Candidate picker chỉ có ý nghĩa khi race đích còn nhận allocation. Race đã
        // draw/không còn Upcoming sẽ bị AllocateAsync chặn; không trả candidate để UI
        // không hiển thị một pairing vừa có trong race vừa ở danh sách chưa allocate.
        if (unallocatedOnly)
        {
            if (targetRace.Status != "Upcoming" || targetRace.IsPostPositionDrawn)
            {
                query = query.Where(_ => false);
            }
            else
            {
                // Một pairing chỉ được thi một lần trong MỘT round. Không dùng trạng
                // thái của race để quyết định ở đây: entry của race Official vẫn là
                // lịch sử hợp lệ của round đó, nhưng entry ở round trước phải không
                // cản pairing được allocate vào round tiếp theo.
                query = query.Where(p =>
                    !p.RaceEntries.Any(re =>
                        re.Race.RoundId == targetRoundId &&
                        re.Status != "Cancelled"));
            }
        }

        // Round dau: pairing Confirmed chua allocate. Round sau: round truoc phai
        // Completed va chi RaceEntry Qualified/AlsoEligible moi duoc hien thi.
        if (previousRound != null)
        {
            if (previousRound.Status != "Completed")
            {
                query = query.Where(_ => false);
            }
            else
            {
                query = query.Where(p => p.RaceEntries.Any(re =>
                    re.Race.RoundId == previousRound.RoundId &&
                    (re.AdvancementStatus == "Qualified" ||
                     re.AdvancementStatus == "AlsoEligible")));
            }
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
                AdvancementStatus = previousRoundId == null
                    ? null
                    : p.RaceEntries
                        .Where(re => re.Race.RoundId == previousRoundId &&
                                     (re.AdvancementStatus == "Qualified" ||
                                      re.AdvancementStatus == "AlsoEligible"))
                        .Select(re => re.AdvancementStatus)
                        .FirstOrDefault(),
                IsAllocated = p.RaceEntries.Any(re =>
                    re.Race.RoundId == targetRoundId &&
                    re.Status != "Cancelled"),
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
