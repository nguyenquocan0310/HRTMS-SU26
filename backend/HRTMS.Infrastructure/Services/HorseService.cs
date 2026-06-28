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

        // Giải đấu phải tồn tại và đang mở đăng ký
        var tournament = await _context.Tournaments.FindAsync(dto.TournamentId);
        if (tournament == null)
            return ApiResponse<HorseResponseDto>.Fail("TOURNAMENT_NOT_FOUND");
        if (tournament.Status != "Open Registration")
            return ApiResponse<HorseResponseDto>.Fail("Giải không ở trạng thái mở đăng ký.");

        // Owner phải đã được Admin duyệt tham gia giải (roster Approved)
        var ownerApproved = await _context.TournamentParticipants.AnyAsync(p =>
            p.TournamentId == dto.TournamentId &&
            p.UserId == ownerId &&
            p.Role == "Owner" &&
            p.Status == "Approved");
        if (!ownerApproved)
            return ApiResponse<HorseResponseDto>.Fail(
                "Bạn chưa được duyệt tham gia giải này. Hãy đăng ký tham gia giải và chờ Admin duyệt trước khi đăng ký ngựa.");

        var horse = new Horse
        {
            OwnerId = ownerId,
            TournamentId = dto.TournamentId,
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
            ScreeningStatus = "NotScreened",
            AdminApprovalStatus = "Pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // REQ-F-HRS.4 + Pha 3: screen ngay khi đăng ký → AutoEligible / ManualReview / AutoRejected
        string category = await ScreenHorseAsync(horse);
        ApplyScreeningToApproval(horse, category);

        _context.Horses.Add(horse);
        await _context.SaveChangesAsync();

        switch (category)
        {
            case "AutoRejected":
                await _auditLog.LogAsync(ownerId, "AutoReject_Horse", "Horse",
                    horse.HorseId.ToString(), "NotScreened", $"AutoRejected: {horse.ScreeningReason}");
                NotifyOwnerHorseRejected(horse);
                await _context.SaveChangesAsync();
                return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse),
                    $"Hồ sơ ngựa bị tự động từ chối: {horse.ScreeningReason}");

            case "AutoEligible":
                await _auditLog.LogAsync(ownerId, "AutoApprove_Horse", "Horse",
                    horse.HorseId.ToString(), "NotScreened", "Approved (AutoEligible)");
                NotifyOwnerHorseApproved(horse);
                await _context.SaveChangesAsync();
                return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse),
                    "Hồ sơ ngựa hợp lệ và đã được hệ thống tự động phê duyệt.");

            default: // ManualReview
                return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse),
                    $"Hồ sơ ngựa đã được khai báo, chờ Admin duyệt. Lý do cần xem xét: {horse.ScreeningReason}");
        }
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
            .Include(h => h.PairingHorses)
            .FirstOrDefaultAsync(h => h.HorseId == horseId);

        if (horse == null)
            return ApiResponse<HorseResponseDto>.Fail("HORSE_NOT_FOUND");

        if (horse.OwnerId != ownerId)
            return ApiResponse<HorseResponseDto>.Fail("HORSE_NOT_OWNED");

        // HRS.1/HRS.2: validate trước khi lưu (đồng bộ với CreateHorseAsync)
        if (dto.BirthYear != null && dto.BirthYear > DateTime.UtcNow.Year)
            return ApiResponse<HorseResponseDto>.Fail("Năm sinh không được ở tương lai.");
        if (dto.DopingTestDate != null && dto.DopingTestDate > DateOnly.FromDateTime(DateTime.UtcNow))
            return ApiResponse<HorseResponseDto>.Fail("Ngày kiểm tra doping không được ở tương lai.");

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

        // HRS.6 / EC-23: re-validate khi trường nhạy cảm thay đổi sau khi đã Approved
        bool revalidated = sensitiveChanged && horse.AdminApprovalStatus == "Approved";
        string category = "AutoEligible";
        if (revalidated)
        {
            // Hủy tất cả Pairing liên quan (DB không hỗ trợ "Suspended" — dùng "Cancelled").
            foreach (var pairing in horse.PairingHorses)
            {
                if (pairing.Status is "Pending" or "Accepted" or "Confirmed")
                {
                    pairing.Status = "Cancelled";
                    pairing.ResponseReason = "Hồ sơ ngựa được sửa thông tin nhạy cảm, cần duyệt lại (EC-23).";
                    pairing.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Chạy lại screening → đưa về Pending/Rejected tùy kết quả.
            category = await ScreenHorseAsync(horse);
            ApplyScreeningToApproval(horse, category);
            if (category == "AutoEligible")
                horse.AdminApprovalStatus = "Pending"; // sửa hồ sơ → bắt buộc Admin duyệt lại
        }

        await _context.SaveChangesAsync();

        string message = !revalidated
            ? "Cập nhật hồ sơ thành công."
            : category == "AutoRejected"
                ? $"Cập nhật thành công nhưng hồ sơ bị tự động từ chối: {horse.ScreeningReason}"
                : "Cập nhật thành công. Hồ sơ đã được đưa về trạng thái chờ duyệt lại do thay đổi thông tin y tế.";

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

        // HRS.4: Admin KHÔNG được override auto-reject cứng (doping Failed / breed mismatch).
        if (horse.ScreeningStatus == "AutoRejected")
            return ApiResponse<string>.Fail(
                $"AUTO_REJECTED: không thể override. Lý do: {horse.ScreeningReason}");

        // Re-screen tại thời điểm duyệt để bắt dữ liệu vi phạm cứng phát sinh sau khai báo.
        string category = await ScreenHorseAsync(horse);
        if (category == "AutoRejected")
        {
            ApplyScreeningToApproval(horse, category);
            horse.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return ApiResponse<string>.Fail(
                $"AUTO_REJECTED: không thể override. Lý do: {horse.ScreeningReason}");
        }

        // ManualReview/AutoEligible → Admin chốt Approved.
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
            Type = "In-app",
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
            Type = "In-app",
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
    /// REQ-F-HRS.4 + Pha 3: screen hồ sơ ngựa, set <see cref="Horse.ScreeningStatus"/> và
    /// <see cref="Horse.ScreeningReason"/>. KHÔNG đụng AdminApprovalStatus (xem ApplyScreeningToApproval).
    /// Trả về category: "AutoRejected" | "ManualReview" | "AutoEligible".
    /// </summary>
    private async Task<string> ScreenHorseAsync(Horse horse)
    {
        // Auto-reject cứng — doping Failed (BR-02). Admin không override.
        if (horse.DopingTestResult == "Failed")
        {
            horse.ScreeningStatus = "AutoRejected";
            horse.ScreeningReason = "Kết quả kiểm tra doping là Failed.";
            return "AutoRejected";
        }

        var tournament = await _context.Tournaments
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TournamentId == horse.TournamentId);

        if (tournament == null)
        {
            horse.ScreeningStatus = "AutoRejected";
            horse.ScreeningReason = "Không xác định được giải đấu của ngựa.";
            return "AutoRejected";
        }

        // Auto-reject cứng — breed mismatch (BR-01). Admin không override.
        if (!string.Equals(horse.Breed, tournament.AllowedBreed, StringComparison.OrdinalIgnoreCase))
        {
            horse.ScreeningStatus = "AutoRejected";
            horse.ScreeningReason =
                $"Giống ngựa '{horse.Breed}' không khớp giống cho phép '{tournament.AllowedBreed}' của giải.";
            return "AutoRejected";
        }

        // Manual review — doping chưa có kết quả rõ ràng (Pha 3: ManualReview).
        if (horse.DopingTestResult == "Pending")
        {
            horse.ScreeningStatus = "ManualReview";
            horse.ScreeningReason = "Kết quả doping đang chờ (Pending) — cần Admin xem xét.";
            return "ManualReview";
        }

        // Auto eligible — breed khớp, doping Clean, consent đã tích, hồ sơ đủ.
        horse.ScreeningStatus = "AutoEligible";
        horse.ScreeningReason = null;
        return "AutoEligible";
    }

    /// <summary>
    /// Ánh xạ category screening → AdminApprovalStatus (giữ 3 giá trị Pending/Approved/Rejected
    /// để FE/contract ổn định; phân biệt auto-reject cứng qua ScreeningStatus = "AutoRejected").
    /// </summary>
    private static void ApplyScreeningToApproval(Horse horse, string category)
    {
        switch (category)
        {
            case "AutoEligible":
                horse.AdminApprovalStatus = "Approved";
                horse.RejectionReason = null;
                break;
            case "AutoRejected":
                horse.AdminApprovalStatus = "Rejected";
                horse.RejectionReason = horse.ScreeningReason;
                break;
            default: // ManualReview
                horse.AdminApprovalStatus = "Pending";
                horse.RejectionReason = null;
                break;
        }
    }

    private void NotifyOwnerHorseApproved(Horse horse) =>
        _context.Notifications.Add(new Notification
        {
            RecipientId = horse.OwnerId,
            Title = "Hồ sơ ngựa được phê duyệt",
            Message = $"Hồ sơ ngựa '{horse.Name}' đã được phê duyệt.",
            Type = "In-app",
            IsRead = false,
            RelatedEntityType = "Horse",
            RelatedEntityId = horse.HorseId,
            SentAt = DateTime.UtcNow
        });

    private void NotifyOwnerHorseRejected(Horse horse) =>
        _context.Notifications.Add(new Notification
        {
            RecipientId = horse.OwnerId,
            Title = "Hồ sơ ngựa bị từ chối",
            Message = $"Hồ sơ ngựa '{horse.Name}' bị từ chối. Lý do: {horse.RejectionReason}",
            Type = "In-app",
            IsRead = false,
            RelatedEntityType = "Horse",
            RelatedEntityId = horse.HorseId,
            SentAt = DateTime.UtcNow
        });

    private static HorseResponseDto MapToDto(Horse h) => new()
    {
        HorseId = h.HorseId,
        OwnerId = h.OwnerId,
        TournamentId = h.TournamentId,
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
        ScreeningStatus = h.ScreeningStatus,
        ScreeningReason = h.ScreeningReason,
        AdminApprovalStatus = h.AdminApprovalStatus,
        RejectionReason = h.RejectionReason,
        CreatedAt = h.CreatedAt,
        UpdatedAt = h.UpdatedAt
    };
    // ── RACE ENTRY ────────────────────────────────────────────────────────────
    // RaceEntry chi do Admin tao qua Module E (SCH.1 - POST /api/admin/races/{raceId}/entries).
    // HorseService chi con phuc vu Owner xem danh sach entry cua minh.

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
        var entry = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);
        if (entry == null) return ApiResponse<string>.Fail("RACE_ENTRY_NOT_FOUND");
        if (entry.EntryFeeStatus == "Paid") return ApiResponse<string>.Fail("FEE_ALREADY_CONFIRMED");

        entry.EntryFeeStatus = "Paid";
        entry.EntryFeeConfirmedBy = adminId;
        entry.EntryFeeConfirmedAt = DateTime.UtcNow;
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Update_Entry_Fee_Status", "RaceEntry",
            raceEntryId.ToString(), "Unpaid", "Paid", null);

        // Bao Owner: le phi da duoc xac nhan (Type phai la In-app/Email/Both).
        _context.Notifications.Add(new Notification
        {
            RecipientId = entry.Pairing.Horse.OwnerId,
            Title = "Lệ phí tham gia đã được xác nhận",
            Message = $"Lệ phí cho ngựa '{entry.Pairing.Horse.Name}' (đăng ký #{raceEntryId}) đã được xác nhận (Paid).",
            Type = "In-app",
            IsRead = false,
            RelatedEntityType = "RaceEntry",
            RelatedEntityId = raceEntryId,
            SentAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

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

        _context.Notifications.Add(new Notification
        {
            RecipientId = entry.Pairing.Horse.OwnerId,
            Title = "Đăng ký race được xác nhận",
            Message = $"Đăng ký #{raceEntryId} cho ngựa '{entry.Pairing.Horse.Name}' đã được Admin xác nhận tham gia cuộc đua.",
            Type = "In-app",
            IsRead = false,
            RelatedEntityType = "RaceEntry",
            RelatedEntityId = raceEntryId,
            SentAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

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
