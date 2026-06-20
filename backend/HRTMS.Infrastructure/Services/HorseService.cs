using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Horse;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class HorseService : IHorseService
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLog;

    // 4 trường nhạy cảm — sửa bất kỳ trường nào → trigger re-validate (EC-23)
    private static readonly string[] SensitiveFields =
        ["Breed", "VaccinationRecordRef", "DopingTestDate", "DopingTestResult"];

    public HorseService(HRTMSDbContext context, IAuditLogService auditLog)
    {
        _context = context;
        _auditLog = auditLog;
    }

    // -------------------------------------------------------------------------
    // OWNER
    // -------------------------------------------------------------------------

    public async Task<ApiResponse<HorseResponseDto>> CreateHorseAsync(int ownerId, CreateHorseDto dto)
    {
        // EC-22: bắt buộc tích cam kết
        if (!dto.LegalConsentAccepted)
            return ApiResponse<HorseResponseDto>.Fail("Bạn phải đồng ý cam kết pháp lý trước khi gửi hồ sơ.");

        // FK check: OwnerProfile phải tồn tại
        var ownerExists = await _context.OwnerProfiles.AnyAsync(o => o.OwnerId == ownerId);
        if (!ownerExists)
            return ApiResponse<HorseResponseDto>.Fail("Không tìm thấy hồ sơ chủ ngựa. Vui lòng hoàn thiện hồ sơ trước.");

        // Validate BirthYear không ở tương lai
        if (dto.BirthYear > DateTime.UtcNow.Year)
            return ApiResponse<HorseResponseDto>.Fail("Năm sinh không được ở tương lai.");

        // Validate DopingTestDate không ở tương lai
        if (dto.DopingTestDate > DateOnly.FromDateTime(DateTime.UtcNow))
            return ApiResponse<HorseResponseDto>.Fail("Ngày kiểm tra doping không được ở tương lai.");

        var horse = new Horse
        {
            OwnerId = ownerId,
            Name = dto.Name.Trim(),
            BirthYear = dto.BirthYear,
            Gender = dto.Gender,
            Color = dto.Color.Trim(),
            Pedigree = dto.Pedigree?.Trim(),
            Weight = dto.Weight,
            IdentifyingMarks = dto.IdentifyingMarks.Trim(),
            Breed = dto.Breed.Trim(),
            VaccinationRecordRef = dto.VaccinationRecordRef.Trim(),
            DopingTestDate = dto.DopingTestDate,
            DopingTestResult = dto.DopingTestResult,
            LegalConsentAccepted = true,
            Status = "Declared",
            AdminApprovalStatus = "Pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Horses.Add(horse);
        await _context.SaveChangesAsync();

        return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse), "Hồ sơ ngựa đã được khai báo thành công.");
    }

    public async Task<ApiResponse<List<HorseResponseDto>>> GetMyHorsesAsync(
        int ownerId, string? approvalStatus, int page, int pageSize)
    {
        var query = _context.Horses
            .Where(h => h.OwnerId == ownerId);

        if (!string.IsNullOrEmpty(approvalStatus))
            query = query.Where(h => h.AdminApprovalStatus == approvalStatus);

        var horses = await query
            .OrderByDescending(h => h.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return ApiResponse<List<HorseResponseDto>>.Ok(horses.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<HorseResponseDto>> GetHorseByIdAsync(int ownerId, int horseId)
    {
        var horse = await _context.Horses.FindAsync(horseId);

        if (horse == null)
            return ApiResponse<HorseResponseDto>.Fail("HORSE_NOT_FOUND");

        if (horse.OwnerId != ownerId)
            return ApiResponse<HorseResponseDto>.Fail("HORSE_NOT_OWNED");

        return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse));
    }

    public async Task<ApiResponse<HorseResponseDto>> UpdateHorseAsync(
        int ownerId, int horseId, UpdateHorseDto dto)
    {
        var horse = await _context.Horses
            .Include(h => h.Pairings)
            .FirstOrDefaultAsync(h => h.HorseId == horseId);

        if (horse == null)
            return ApiResponse<HorseResponseDto>.Fail("HORSE_NOT_FOUND");

        if (horse.OwnerId != ownerId)
            return ApiResponse<HorseResponseDto>.Fail("HORSE_NOT_OWNED");

        // Kiểm tra có sửa trường nhạy cảm không
        bool sensitiveChanged =
            (dto.Breed != null && dto.Breed != horse.Breed) ||
            (dto.VaccinationRecordRef != null && dto.VaccinationRecordRef != horse.VaccinationRecordRef) ||
            (dto.DopingTestDate != null && dto.DopingTestDate != horse.DopingTestDate) ||
            (dto.DopingTestResult != null && dto.DopingTestResult != horse.DopingTestResult);

        // Cập nhật các field được gửi lên
        if (dto.Name != null) horse.Name = dto.Name.Trim();
        if (dto.BirthYear != null) horse.BirthYear = dto.BirthYear.Value;
        if (dto.Gender != null) horse.Gender = dto.Gender;
        if (dto.Color != null) horse.Color = dto.Color.Trim();
        if (dto.Pedigree != null) horse.Pedigree = dto.Pedigree.Trim();
        if (dto.Weight != null) horse.Weight = dto.Weight.Value;
        if (dto.IdentifyingMarks != null) horse.IdentifyingMarks = dto.IdentifyingMarks.Trim();
        if (dto.Breed != null) horse.Breed = dto.Breed.Trim();
        if (dto.VaccinationRecordRef != null) horse.VaccinationRecordRef = dto.VaccinationRecordRef.Trim();
        if (dto.DopingTestDate != null) horse.DopingTestDate = dto.DopingTestDate.Value;
        if (dto.DopingTestResult != null) horse.DopingTestResult = dto.DopingTestResult;

        horse.UpdatedAt = DateTime.UtcNow;

        // EC-23: re-validate khi trường nhạy cảm thay đổi
        if (sensitiveChanged && horse.AdminApprovalStatus == "Approved")
        {
            horse.AdminApprovalStatus = "Pending";

            // Treo tất cả Pairing liên quan
            foreach (var pairing in horse.Pairings)
            {
                pairing.Status = "Suspended";
                pairing.UpdatedAt = DateTime.UtcNow;
            }

            // Chạy lại auto-reject check
            RunAutoRejectCheck(horse);
        }

        await _context.SaveChangesAsync();

        string message = sensitiveChanged
            ? "Cập nhật thành công. Hồ sơ đã được đưa về trạng thái chờ duyệt lại do thay đổi thông tin y tế."
            : "Cập nhật hồ sơ thành công.";

        return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse), message);
    }

    // -------------------------------------------------------------------------
    // ADMIN
    // -------------------------------------------------------------------------

    public async Task<ApiResponse<List<HorseResponseDto>>> GetPendingHorsesAsync(int page, int pageSize)
    {
        var horses = await _context.Horses
            .Where(h => h.AdminApprovalStatus == "Pending")
            .OrderByDescending(h => h.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return ApiResponse<List<HorseResponseDto>>.Ok(horses.Select(MapToDto).ToList());
    }

    public async Task<ApiResponse<HorseResponseDto>> GetHorseByIdAdminAsync(int horseId)
    {
        var horse = await _context.Horses.FindAsync(horseId);

        if (horse == null)
            return ApiResponse<HorseResponseDto>.Fail("HORSE_NOT_FOUND");

        return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse));
    }

    public async Task<ApiResponse<string>> ApproveHorseAsync(int adminId, int horseId)
    {
        var horse = await _context.Horses.FindAsync(horseId);

        if (horse == null)
            return ApiResponse<string>.Fail("HORSE_NOT_FOUND");

        if (horse.AdminApprovalStatus == "Approved")
            return ApiResponse<string>.Fail("ALREADY_APPROVED");

        // Chạy auto-reject check trước khi approve
        string? rejectReason = RunAutoRejectCheck(horse);
        if (rejectReason != null)
        {
            horse.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return ApiResponse<string>.Fail(rejectReason);
        }

        horse.AdminApprovalStatus = "Approved";
        horse.RejectionReason = null;
        horse.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: adminId,
            action: "Approve_Horse",
            entityName: "Horse",
            entityId: horseId.ToString(),
            oldValue: "Pending",
            newValue: "Approved",
            ipAddress: null);

        // Gửi notification cho Owner
        _context.Notifications.Add(new Notification
        {
            RecipientId = horse.OwnerId,
            Title = "Hồ sơ ngựa được phê duyệt",
            Message = $"Hồ sơ ngựa '{horse.Name}' đã được Admin phê duyệt.",
            Type = "HorseApproved",
            IsRead = false,
            RelatedEntityType = "Horse",
            RelatedEntityId = horseId,
            SentAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        return ApiResponse<string>.Ok("Hồ sơ ngựa đã được phê duyệt.");
    }

    public async Task<ApiResponse<string>> RejectHorseAsync(int adminId, int horseId, AdminRejectHorseDto dto)
    {
        var horse = await _context.Horses.FindAsync(horseId);

        if (horse == null)
            return ApiResponse<string>.Fail("HORSE_NOT_FOUND");

        if (horse.AdminApprovalStatus == "Rejected")
            return ApiResponse<string>.Fail("ALREADY_REJECTED");

        string oldStatus = horse.AdminApprovalStatus;

        horse.AdminApprovalStatus = "Rejected";
        horse.RejectionReason = dto.Reason.Trim();
        horse.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: adminId,
            action: "Reject_Horse",
            entityName: "Horse",
            entityId: horseId.ToString(),
            oldValue: oldStatus,
            newValue: "Rejected",
            ipAddress: null);

        // Gửi notification cho Owner kèm lý do
        _context.Notifications.Add(new Notification
        {
            RecipientId = horse.OwnerId,
            Title = "Hồ sơ ngựa bị từ chối",
            Message = $"Hồ sơ ngựa '{horse.Name}' bị từ chối. Lý do: {dto.Reason}",
            Type = "HorseRejected",
            IsRead = false,
            RelatedEntityType = "Horse",
            RelatedEntityId = horseId,
            SentAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        return ApiResponse<string>.Ok("Hồ sơ ngựa đã bị từ chối.");
    }

    // -------------------------------------------------------------------------
    // PRIVATE HELPERS
    // -------------------------------------------------------------------------

    /// <summary>
    /// Chạy auto-reject check theo breed và doping.
    /// Trả về null nếu hợp lệ, trả về mã lỗi nếu bị reject.
    /// Tự động set AdminApprovalStatus = "Rejected" nếu vi phạm (không cần SaveChanges ở đây).
    /// </summary>
    private string? RunAutoRejectCheck(Horse horse)
    {
        // Check doping trước — không cần query thêm
        if (horse.DopingTestResult == "Failed")
        {
            horse.AdminApprovalStatus = "Rejected";
            horse.RejectionReason = "Auto-reject: kết quả kiểm tra doping là Failed.";
            return "AUTO_REJECTED_DOPING";
        }

        // TODO (Bước 2 - khi có RaceEntry): check breed khớp Tournament.AllowedBreed
        // Hiện tại chưa có RaceEntry context nên bỏ qua breed check tại đây.
        // Breed check sẽ được thực hiện tại endpoint ApproveRaceEntry.

        return null;
    }

    private static HorseResponseDto MapToDto(Horse h) => new()
    {
        HorseId = h.HorseId,
        OwnerId = h.OwnerId,
        Name = h.Name,
        BirthYear = h.BirthYear,
        Gender = h.Gender,
        Color = h.Color,
        Pedigree = h.Pedigree,
        Weight = h.Weight,
        IdentifyingMarks = h.IdentifyingMarks,
        Breed = h.Breed,
        VaccinationRecordRef = h.VaccinationRecordRef,
        DopingTestDate = h.DopingTestDate,
        DopingTestResult = h.DopingTestResult,
        LegalConsentAccepted = h.LegalConsentAccepted,
        AdminApprovalStatus = h.AdminApprovalStatus,
        RejectionReason = h.RejectionReason,
        CreatedAt = h.CreatedAt,
        UpdatedAt = h.UpdatedAt
    };
    // ── RACE ENTRY ────────────────────────────────────────────────────────────

    public async Task<ApiResponse<RaceEntryResponseDto>> CreateRaceEntryAsync(int ownerId, CreateRaceEntryDto dto)
    {
        var pairing = await _context.Pairings
            .Include(p => p.Horse)
            .Include(p => p.Jockey).ThenInclude(j => j.Jockey)
            .FirstOrDefaultAsync(p => p.PairingId == dto.PairingId);

        if (pairing == null)
            return ApiResponse<RaceEntryResponseDto>.Fail("PAIRING_NOT_FOUND");
        if (pairing.Horse.OwnerId != ownerId)
            return ApiResponse<RaceEntryResponseDto>.Fail("PAIRING_NOT_OWNED");
        if (pairing.Status != "Accepted")
            return ApiResponse<RaceEntryResponseDto>.Fail("PAIRING_NOT_ACCEPTED");
        if (pairing.Horse.AdminApprovalStatus != "Approved")
            return ApiResponse<RaceEntryResponseDto>.Fail("HORSE_NOT_APPROVED");

        var race = await _context.Races
            .Include(r => r.Round).ThenInclude(r => r.Tournament)
            .FirstOrDefaultAsync(r => r.RaceId == dto.RaceId);

        if (race == null)
            return ApiResponse<RaceEntryResponseDto>.Fail("RACE_NOT_FOUND");

        var tournament = race.Round.Tournament;

        int currentEntries = await _context.RaceEntries
            .CountAsync(e => e.RaceId == dto.RaceId
                          && e.Status != "Cancelled"
                          && e.Status != "Disqualified");
        if (currentEntries >= tournament.MaxHorses)
            return ApiResponse<RaceEntryResponseDto>.Fail("RACE_FULL");

        bool horseInRace = await _context.RaceEntries
            .Include(e => e.Pairing)
            .AnyAsync(e => e.RaceId == dto.RaceId
                        && e.Pairing.HorseId == pairing.HorseId
                        && e.Status != "Cancelled"
                        && e.Status != "Disqualified");
        if (horseInRace)
            return ApiResponse<RaceEntryResponseDto>.Fail("DUPLICATE_HORSE_IN_RACE");

        bool jockeyInRace = await _context.RaceEntries
            .Include(e => e.Pairing)
            .AnyAsync(e => e.RaceId == dto.RaceId
                        && e.Pairing.JockeyId == pairing.JockeyId
                        && e.Status != "Cancelled"
                        && e.Status != "Disqualified");
        if (jockeyInRace)
            return ApiResponse<RaceEntryResponseDto>.Fail("DUPLICATE_JOCKEY_IN_RACE");

        string feeStatus = tournament.EntryFeeAmount == 0 ? "Paid" : "Unpaid";

        var entry = new RaceEntry
        {
            RaceId = dto.RaceId,
            PairingId = dto.PairingId,
            Status = "Pending",
            EntryFeeStatus = feeStatus,
            IsWithdrawn = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.RaceEntries.Add(entry);
        await _context.SaveChangesAsync();

        return ApiResponse<RaceEntryResponseDto>.Ok(
            await MapToRaceEntryDtoAsync(entry.RaceEntryId, tournament.EntryFeeAmount),
            "Đăng ký tham gia cuộc đua thành công.");
    }

    public async Task<ApiResponse<List<RaceEntryResponseDto>>> GetMyRaceEntriesAsync(
        int ownerId, string? status, string? feeStatus, int page, int pageSize)
    {
        var query = _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .Include(e => e.Race).ThenInclude(r => r.Round).ThenInclude(r => r.Tournament)
            .Where(e => e.Pairing.Horse.OwnerId == ownerId);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(e => e.Status == status);
        if (!string.IsNullOrEmpty(feeStatus))
            query = query.Where(e => e.EntryFeeStatus == feeStatus);

        var entries = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = entries.Select(e => MapToRaceEntryDto(e)).ToList();
        return ApiResponse<List<RaceEntryResponseDto>>.Ok(result);
    }

    public async Task<ApiResponse<List<RaceEntryResponseDto>>> GetPendingFeeEntriesAsync(int page, int pageSize)
    {
        var entries = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .Include(e => e.Race).ThenInclude(r => r.Round).ThenInclude(r => r.Tournament)
            .Where(e => e.EntryFeeStatus == "Unpaid")
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return ApiResponse<List<RaceEntryResponseDto>>.Ok(entries.Select(MapToRaceEntryDto).ToList());
    }

    public async Task<ApiResponse<string>> ConfirmEntryFeeAsync(int adminId, int raceEntryId)
    {
        var entry = await _context.RaceEntries.FindAsync(raceEntryId);
        if (entry == null) return ApiResponse<string>.Fail("RACE_ENTRY_NOT_FOUND");
        if (entry.EntryFeeStatus == "Paid") return ApiResponse<string>.Fail("FEE_ALREADY_CONFIRMED");

        entry.EntryFeeStatus = "Paid";
        entry.EntryFeeConfirmedBy = adminId;
        entry.EntryFeeConfirmedAt = DateTime.UtcNow;
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Confirm_Entry_Fee", "RaceEntry",
            raceEntryId.ToString(), "Unpaid", "Paid", null);

        return ApiResponse<string>.Ok("Lệ phí đã được xác nhận.");
    }

    public async Task<ApiResponse<string>> ApproveRaceEntryAsync(int adminId, int raceEntryId)
    {
        var entry = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(e => e.Race).ThenInclude(r => r.Round).ThenInclude(r => r.Tournament)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);

        if (entry == null) return ApiResponse<string>.Fail("RACE_ENTRY_NOT_FOUND");
        if (entry.EntryFeeStatus != "Paid") return ApiResponse<string>.Fail("ENTRY_FEE_NOT_PAID");
        if (entry.Pairing.Horse.AdminApprovalStatus != "Approved")
            return ApiResponse<string>.Fail("HORSE_NOT_APPROVED");
        if (entry.Status == "Confirmed") return ApiResponse<string>.Fail("ENTRY_ALREADY_CONFIRMED");

        // Breed check — có Tournament context tại đây
        string allowedBreed = entry.Race.Round.Tournament.AllowedBreed;
        if (entry.Pairing.Horse.Breed != allowedBreed)
            return ApiResponse<string>.Fail($"AUTO_REJECTED_BREED: yêu cầu '{allowedBreed}', ngựa có '{entry.Pairing.Horse.Breed}'.");

        entry.Status = "Confirmed";
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Approve_RaceEntry", "RaceEntry",
            raceEntryId.ToString(), "Pending", "Confirmed", null);

        return ApiResponse<string>.Ok("Đăng ký tham gia cuộc đua đã được xác nhận.");
    }

    public async Task<ApiResponse<string>> RejectRaceEntryAsync(int adminId, int raceEntryId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 10)
            return ApiResponse<string>.Fail("Lý do từ chối phải có ít nhất 10 ký tự.");

        var entry = await _context.RaceEntries.FindAsync(raceEntryId);
        if (entry == null) return ApiResponse<string>.Fail("RACE_ENTRY_NOT_FOUND");
        if (entry.Status == "Rejected") return ApiResponse<string>.Fail("ALREADY_REJECTED");

        string oldStatus = entry.Status;
        entry.Status = "Rejected";
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Reject_RaceEntry", "RaceEntry",
            raceEntryId.ToString(), oldStatus, $"Rejected: {reason}", null);

        return ApiResponse<string>.Ok("Đã từ chối đăng ký.");
    }

    // Helpers
    private static RaceEntryResponseDto MapToRaceEntryDto(RaceEntry e) => new()
    {
        RaceEntryId = e.RaceEntryId,
        Status = e.Status,
        EntryFeeStatus = e.EntryFeeStatus,
        EntryFeeAmount = e.Race.Round.Tournament.EntryFeeAmount,
        CreatedAt = e.CreatedAt,
        Race = new RaceEntryRaceDto
        {
            RaceId = e.Race.RaceId,
            RaceNumber = e.Race.RaceNumber,
            ScheduledTime = e.Race.ScheduledTime,
            TournamentName = e.Race.Round.Tournament.Name
        },
        Horse = new RaceEntryHorseDto
        {
            HorseId = e.Pairing.Horse.HorseId,
            Name = e.Pairing.Horse.Name
        },
        Jockey = new RaceEntryJockeyDto
        {
            JockeyId = e.Pairing.Jockey.JockeyId,
            FullName = e.Pairing.Jockey.Jockey.FullName
        }
    };

    private async Task<RaceEntryResponseDto> MapToRaceEntryDtoAsync(int raceEntryId, decimal feeAmount)
    {
        var e = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .Include(e => e.Race).ThenInclude(r => r.Round).ThenInclude(r => r.Tournament)
            .FirstAsync(e => e.RaceEntryId == raceEntryId);
        return MapToRaceEntryDto(e);
    }

}