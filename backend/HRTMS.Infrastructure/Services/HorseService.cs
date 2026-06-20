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
}