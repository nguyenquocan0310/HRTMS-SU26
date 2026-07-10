using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Horse;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
// Alias tránh đụng độ RaceEntryResponseDto giữa DTOs.Horse và DTOs.RaceEntry.
using RaceEntryDtos = HRTMS.Core.DTOs.RaceEntry;

namespace HRTMS.Infrastructure.Services;

public class HorseService : IHorseService
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLog;
    private readonly INotificationService _notification;
    // Withdraw-flow dùng chung của Module E (fee -> Refund Pending, hoàn điểm dự đoán,
    // giải phóng PostPosition, notification) — không tự set status entry tay ở đây.
    private readonly IRaceEntryService _raceEntry;

    // 4 trường nhạy cảm — sửa bất kỳ trường nào → trigger re-validate
    private static readonly string[] SensitiveFields =
        ["Breed", "VaccinationRecordRef", "DopingTestDate", "DopingTestResult"];

    public HorseService(
        HRTMSDbContext context,
        IAuditLogService auditLog,
        INotificationService notification,
        IRaceEntryService raceEntry)
    {
        _context = context;
        _auditLog = auditLog;
        _notification = notification;
        _raceEntry = raceEntry;
    }

    // Entry còn "sống" trong race chưa chạy — đối tượng của cascade withdraw.
    private async Task<List<int>> GetActiveEntryIdsAsync(IReadOnlyCollection<int> pairingIds)
    {
        if (pairingIds.Count == 0) return [];
        return await _context.RaceEntries
            .Where(re => pairingIds.Contains(re.PairingId) &&
                         (re.Status == "Pending" || re.Status == "Confirmed") &&
                         re.Race.Status == "Upcoming")
            .Select(re => re.RaceEntryId)
            .ToListAsync();
    }

    // -------------------------------------------------------------------------
    // OWNER
    // -------------------------------------------------------------------------

    public async Task<ApiResponse<HorseResponseDto>> CreateHorseAsync(int ownerId, CreateHorseDto dto)
    {
        // Bắt buộc tích cam kết
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

        // Schema v3: tạo hồ sơ vào KHO — KHÔNG gắn giải, KHÔNG screen breed (chưa biết giải).
        // Screening breed/doping theo giải đã chuyển sang EnrollHorseAsync.
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
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Baseline profile-level: doping Failed → khóa hồ sơ; còn lại hồ sơ dùng được.
        // Gate thật sự để vào giải là enrollment + Admin duyệt enrollment (duyệt lại mỗi giải).
        ApplyProfileScreening(horse);

        _context.Horses.Add(horse);
        await _context.SaveChangesAsync();

        if (horse.AdminApprovalStatus == "Rejected")
        {
            await _auditLog.LogAsync(ownerId, "AutoReject_Horse", "Horse",
                horse.HorseId.ToString(), "NotScreened", $"AutoRejected: {horse.ScreeningReason}");
            await _notification.SendAsync(
                horse.OwnerId,
                "Hồ sơ ngựa bị từ chối",
                $"Hồ sơ ngựa '{horse.Name}' bị từ chối. Lý do: {horse.RejectionReason}",
                type: "Both",
                relatedEntityType: "Horse", relatedEntityId: horse.HorseId);
            return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse),
                $"Hồ sơ ngựa bị từ chối. Lý do: {horse.ScreeningReason}");
        }

        return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse),
            "Đã lưu hồ sơ ngựa. Bạn có thể đăng ký ngựa vào giải để thi đấu.");
    }

    /// <summary>
    /// Owner "đẩy" một con ngựa trong kho vào một giải. Chạy screening (breed/doping/roster)
    /// theo rule của giải đó và tạo bản ghi enrollment với AdminApproval riêng (duyệt lại mỗi giải).
    /// </summary>
    public async Task<ApiResponse<HorseEnrollmentResponseDto>> EnrollHorseAsync(
        int ownerId, int horseId, EnrollHorseDto dto)
    {
        var horse = await _context.Horses.FirstOrDefaultAsync(h => h.HorseId == horseId);
        if (horse == null)
            return ApiResponse<HorseEnrollmentResponseDto>.Fail("Không tìm thấy hồ sơ ngựa này.");
        if (horse.OwnerId != ownerId)
            return ApiResponse<HorseEnrollmentResponseDto>.Fail("Ngựa này không thuộc quyền sở hữu của bạn.");

        // Giải đấu phải tồn tại và đang mở đăng ký
        var tournament = await _context.Tournaments.FindAsync(dto.TournamentId);
        if (tournament == null)
            return ApiResponse<HorseEnrollmentResponseDto>.Fail("Không tìm thấy giải đấu này.");
        if (tournament.Status != "Open Registration")
            return ApiResponse<HorseEnrollmentResponseDto>.Fail("Giải hiện không mở đăng ký.");

        // Owner phải đã được Admin duyệt tham gia giải (roster Approved)
        var ownerApproved = await _context.TournamentParticipants.AnyAsync(p =>
            p.TournamentId == dto.TournamentId &&
            p.UserId == ownerId &&
            p.Role == "Owner" &&
            p.Status == "Approved");
        if (!ownerApproved)
            return ApiResponse<HorseEnrollmentResponseDto>.Fail(
                "Bạn chưa được duyệt tham gia giải này. Vui lòng đăng ký tham gia và chờ được duyệt trước khi thêm ngựa vào giải.");

        // Không cho enroll trùng một con ngựa vào cùng một giải
        var already = await _context.HorseTournamentEntries.AnyAsync(e =>
            e.HorseId == horseId && e.TournamentId == dto.TournamentId);
        if (already)
            return ApiResponse<HorseEnrollmentResponseDto>.Fail("Ngựa này đã được đăng ký vào giải rồi.");

        // Mỗi con ngựa chỉ tham gia 1 giải CHƯA kết thúc tại một thời điểm.
        // Giải 'Open Registration'/'Closed Registration' = đang diễn ra; 'Completed'/'Cancelled' = đã xong.
        // Enrollment đã 'Withdrawn' hoặc bị 'Rejected' không tính là đang tham gia.
        var activeElsewhere = await _context.HorseTournamentEntries
            .Include(e => e.Tournament)
            .AnyAsync(e =>
                e.HorseId == horseId &&
                e.Status == "Enrolled" &&
                e.AdminApprovalStatus != "Rejected" &&
                (e.Tournament.Status == "Open Registration" ||
                 e.Tournament.Status == "Closed Registration"));
        if (activeElsewhere)
            return ApiResponse<HorseEnrollmentResponseDto>.Fail(
                "Ngựa này đang tham gia một giải chưa kết thúc. Vui lòng đợi giải đó kết thúc trước khi đăng ký ngựa vào giải mới.");

        var entry = new HorseTournamentEntry
        {
            HorseId = horseId,
            TournamentId = dto.TournamentId,
            OwnerId = horse.OwnerId,
            Status = "Enrolled",
            ScreeningStatus = "NotScreened",
            AdminApprovalStatus = "Pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        // Screen breed/doping theo giải → AutoEligible / ManualReview / AutoRejected
        string category = ScreenEnrollment(horse, tournament, entry);
        ApplyScreeningToEnrollment(entry, category);

        _context.HorseTournamentEntries.Add(entry);
        await _context.SaveChangesAsync();

        switch (category)
        {
            case "AutoRejected":
                await _auditLog.LogAsync(ownerId, "AutoReject_Enrollment", "HorseTournamentEntry",
                    entry.EnrollmentId.ToString(), "NotScreened", $"AutoRejected: {entry.ScreeningReason}");
                await _notification.SendAsync(
                    horse.OwnerId,
                    "Ngựa bị từ chối tham gia giải",
                    $"Ngựa '{horse.Name}' bị từ chối tham gia giải '{tournament.Name}'. Lý do: {entry.ScreeningReason}",
                    type: "Both",
                    relatedEntityType: "HorseTournamentEntry", relatedEntityId: entry.EnrollmentId);
                return ApiResponse<HorseEnrollmentResponseDto>.Ok(MapToEnrollmentDto(entry, horse, tournament),
                    $"Ngựa không đủ điều kiện dự giải. Lý do: {entry.ScreeningReason}");

            case "AutoEligible":
                await _auditLog.LogAsync(ownerId, "AutoApprove_Enrollment", "HorseTournamentEntry",
                    entry.EnrollmentId.ToString(), "NotScreened", "Approved (AutoEligible)");
                await _notification.SendAsync(
                    horse.OwnerId,
                    "Ngựa được phê duyệt vào giải",
                    $"Ngựa '{horse.Name}' đã được tự động phê duyệt vào giải '{tournament.Name}' (enrollment #{entry.EnrollmentId}).",
                    type: "Both",
                    relatedEntityType: "HorseTournamentEntry", relatedEntityId: entry.EnrollmentId);
                return ApiResponse<HorseEnrollmentResponseDto>.Ok(MapToEnrollmentDto(entry, horse, tournament),
                    "Ngựa hợp lệ và đã được hệ thống tự động phê duyệt vào giải.");

            default: // ManualReview
                return ApiResponse<HorseEnrollmentResponseDto>.Ok(MapToEnrollmentDto(entry, horse, tournament),
                    $"Đã gửi đăng ký ngựa vào giải, đang chờ duyệt. Lý do cần xem xét thêm: {entry.ScreeningReason}");
        }
    }

    public async Task<ApiResponse<List<HorseEnrollmentResponseDto>>> GetMyEnrollmentsAsync(
        int ownerId, int? horseId, int? tournamentId, string? adminApprovalStatus, int page, int pageSize)
    {
        var query = _context.HorseTournamentEntries
            .Include(e => e.Horse)
            .Include(e => e.Tournament)
            .Where(e => e.OwnerId == ownerId);

        if (horseId.HasValue)
            query = query.Where(e => e.HorseId == horseId.Value);
        if (tournamentId.HasValue)
            query = query.Where(e => e.TournamentId == tournamentId.Value);
        if (!string.IsNullOrEmpty(adminApprovalStatus))
            query = query.Where(e => e.AdminApprovalStatus == adminApprovalStatus);

        var entries = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var result = entries.Select(e => MapToEnrollmentDto(e, e.Horse, e.Tournament)).ToList();
        return ApiResponse<List<HorseEnrollmentResponseDto>>.Ok(result);
    }

    /// <summary>
    /// Owner rút một con ngựa khỏi một giải (soft-withdraw enrollment) — CHỈ khi chưa có pairing
    /// active trong giải đó. Không hard-delete vì FK_Pairings_HorseTournament trỏ vào row này.
    /// </summary>
    public async Task<ApiResponse<string>> WithdrawEnrollmentAsync(int ownerId, int horseId, int enrollmentId)
    {
        var entry = await _context.HorseTournamentEntries
            .Include(e => e.Horse)
            .Include(e => e.Tournament)
            .FirstOrDefaultAsync(e => e.EnrollmentId == enrollmentId);

        if (entry == null || entry.HorseId != horseId)
            return ApiResponse<string>.Fail("Không tìm thấy đăng ký ngựa vào giải này.");
        if (entry.OwnerId != ownerId)
            return ApiResponse<string>.Fail("Đăng ký này không thuộc quyền sở hữu của bạn.");
        if (entry.Status == "Withdrawn")
            return ApiResponse<string>.Fail("Ngựa này đã được rút khỏi giải trước đó.");

        // "Trước khi pairing": chặn rút nếu ngựa đã có pairing active trong đúng giải này.
        var hasActivePairing = await _context.Pairings.AnyAsync(p =>
            p.HorseId == horseId &&
            p.TournamentId == entry.TournamentId &&
            (p.Status == "Pending" || p.Status == "Accepted" || p.Status == "Confirmed"));
        if (hasActivePairing)
            return ApiResponse<string>.Fail(
                "Ngựa này đang có cặp thi đấu trong giải. Vui lòng hủy cặp trước khi rút ngựa khỏi giải.");

        entry.Status = "Withdrawn";
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(ownerId, "Withdraw_Enrollment", "HorseTournamentEntry",
            enrollmentId.ToString(), "Enrolled", "Withdrawn", null);

        _context.Notifications.Add(new Notification
        {
            RecipientId = ownerId,
            Title = "Đã rút ngựa khỏi giải",
            Message = $"Ngựa '{entry.Horse.Name}' đã được rút khỏi giải '{entry.Tournament.Name}'.",
            Type = "In-app",
            IsRead = false,
            RelatedEntityType = "HorseTournamentEntry",
            RelatedEntityId = enrollmentId,
            SentAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        return ApiResponse<string>.Ok("Đã rút ngựa khỏi giải.");
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
            return ApiResponse<HorseResponseDto>.Fail("Không tìm thấy hồ sơ ngựa này.");

        if (horse.OwnerId != ownerId)
            return ApiResponse<HorseResponseDto>.Fail("Ngựa này không thuộc quyền sở hữu của bạn.");

        return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse));
    }

    public async Task<ApiResponse<HorseResponseDto>> UpdateHorseAsync(
        int ownerId, int horseId, UpdateHorseDto dto)
    {
        var horse = await _context.Horses
            .Include(h => h.PairingHorses)
            .FirstOrDefaultAsync(h => h.HorseId == horseId);

        if (horse == null)
            return ApiResponse<HorseResponseDto>.Fail("Không tìm thấy hồ sơ ngựa này.");

        if (horse.OwnerId != ownerId)
            return ApiResponse<HorseResponseDto>.Fail("Ngựa này không thuộc quyền sở hữu của bạn.");

        // Validate trước khi lưu (đồng bộ với CreateHorseAsync)
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

        // Sửa trường nhạy cảm → re-screen baseline hồ sơ + MỌI enrollment đang Enrolled.
        bool revalidated = sensitiveChanged;
        if (revalidated)
        {
            // Toàn bộ re-screen + hủy pairing + withdraw entry trong MỘT transaction —
            // withdraw-flow của Module E ambient-aware nên không mở transaction lồng.
            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Baseline profile (doping có thể đổi sang Failed → khóa hồ sơ).
                ApplyProfileScreening(horse);

                var cancelledPairingIds = new List<int>();

                var entries = await _context.HorseTournamentEntries
                    .Where(e => e.HorseId == horseId && e.Status == "Enrolled")
                    .ToListAsync();

                if (entries.Count > 0)
                {
                    var tournamentIds = entries.Select(e => e.TournamentId).ToList();
                    var tournaments = await _context.Tournaments
                        .Where(t => tournamentIds.Contains(t.TournamentId))
                        .ToDictionaryAsync(t => t.TournamentId);

                    foreach (var entry in entries)
                    {
                        if (!tournaments.TryGetValue(entry.TournamentId, out var t)) continue;

                        string cat = ScreenEnrollment(horse, t, entry);
                        ApplyScreeningToEnrollment(entry, cat);
                        if (cat == "AutoEligible")
                            entry.AdminApprovalStatus = "Pending"; // sửa hồ sơ → buộc Admin duyệt lại
                        entry.UpdatedAt = DateTime.UtcNow;

                        // Hủy Pairing của đúng giải đó (DB không hỗ trợ "Suspended" — dùng "Cancelled").
                        foreach (var pairing in horse.PairingHorses)
                        {
                            if (pairing.TournamentId == entry.TournamentId &&
                                pairing.Status is "Pending" or "Accepted" or "Confirmed")
                            {
                                pairing.Status = "Cancelled";
                                pairing.ResponseReason = "Hồ sơ ngựa vừa thay đổi thông tin quan trọng nên cần được duyệt lại.";
                                pairing.UpdatedAt = DateTime.UtcNow;
                                cancelledPairingIds.Add(pairing.PairingId);
                            }
                        }
                    }
                }

                await _context.SaveChangesAsync();

                // HRS.6: entry active của pairing vừa hủy đi qua withdraw-flow —
                // fee Paid -> Refund Pending, hoàn điểm dự đoán, giải phóng cổng,
                // notification. Chỉ race còn Upcoming; race đã chạy giữ dữ liệu lịch sử.
                foreach (var raceEntryId in await GetActiveEntryIdsAsync(cancelledPairingIds))
                {
                    await _raceEntry.WithdrawAsync(ownerId, raceEntryId,
                        new RaceEntryDtos.WithdrawEntryDto
                        {
                            Reason = "Hồ sơ ngựa thay đổi thông tin quan trọng nên cần được duyệt lại."
                        },
                        isSystem: true);
                }

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        else
        {
            await _context.SaveChangesAsync();
        }

        string message = !revalidated
            ? "Cập nhật hồ sơ thành công."
            : "Cập nhật thành công. Các đăng ký dự giải liên quan đã được kiểm tra lại.";

        return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse), message);
    }

    // -------------------------------------------------------------------------
    // ADMIN
    // -------------------------------------------------------------------------

    public async Task<ApiResponse<List<HorseEnrollmentResponseDto>>> GetPendingEnrollmentsAsync(int page, int pageSize)
    {
        var entries = await _context.HorseTournamentEntries
            .Include(e => e.Horse)
            .Include(e => e.Tournament)
            .Where(e => e.AdminApprovalStatus == "Pending")
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return ApiResponse<List<HorseEnrollmentResponseDto>>.Ok(
            entries.Select(e => MapToEnrollmentDto(e, e.Horse, e.Tournament)).ToList());
    }

    public async Task<ApiResponse<HorseResponseDto>> GetHorseByIdAdminAsync(int horseId)
    {
        var horse = await _context.Horses.FindAsync(horseId);

        if (horse == null)
            return ApiResponse<HorseResponseDto>.Fail("Không tìm thấy hồ sơ ngựa này.");

        return ApiResponse<HorseResponseDto>.Ok(MapToDto(horse));
    }

    public async Task<ApiResponse<string>> ApproveEnrollmentAsync(int adminId, int enrollmentId)
    {
        var entry = await _context.HorseTournamentEntries
            .Include(e => e.Horse)
            .Include(e => e.Tournament)
            .FirstOrDefaultAsync(e => e.EnrollmentId == enrollmentId);

        if (entry == null)
            return ApiResponse<string>.Fail("Không tìm thấy đăng ký ngựa vào giải này.");

        if (entry.AdminApprovalStatus == "Approved")
            return ApiResponse<string>.Fail("Đăng ký này đã được duyệt trước đó.");

        // Admin KHÔNG được override auto-reject cứng (doping Failed / breed mismatch).
        if (entry.ScreeningStatus == "AutoRejected")
            return ApiResponse<string>.Fail(
                $"Ngựa bị hệ thống tự động từ chối, không thể duyệt lại. Lý do: {entry.ScreeningReason}");

        // Re-screen tại thời điểm duyệt để bắt dữ liệu vi phạm cứng phát sinh sau khi đẩy vào giải.
        string category = ScreenEnrollment(entry.Horse, entry.Tournament, entry);
        if (category == "AutoRejected")
        {
            ApplyScreeningToEnrollment(entry, category);
            entry.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return ApiResponse<string>.Fail(
                $"Ngựa bị hệ thống tự động từ chối, không thể duyệt lại. Lý do: {entry.ScreeningReason}");
        }

        // ManualReview/AutoEligible → Admin chốt Approved.
        entry.AdminApprovalStatus = "Approved";
        entry.RejectionReason = null;
        entry.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: adminId,
            action: "Approve_Enrollment",
            entityName: "HorseTournamentEntry",
            entityId: enrollmentId.ToString(),
            oldValue: "Pending",
            newValue: "Approved",
            ipAddress: null);

        await _notification.SendAsync(
            entry.Horse.OwnerId,
            "Ngựa được phê duyệt vào giải",
            $"Ngựa '{entry.Horse.Name}' đã được Admin phê duyệt tham gia giải '{entry.Tournament.Name}'.",
            type: "Both",
            relatedEntityType: "HorseTournamentEntry", relatedEntityId: enrollmentId);

        return ApiResponse<string>.Ok("Đã phê duyệt ngựa tham gia giải.");
    }

    public async Task<ApiResponse<string>> RejectEnrollmentAsync(int adminId, int enrollmentId, AdminRejectHorseDto dto)
    {
        var entry = await _context.HorseTournamentEntries
            .Include(e => e.Horse)
            .Include(e => e.Tournament)
            .FirstOrDefaultAsync(e => e.EnrollmentId == enrollmentId);

        if (entry == null)
            return ApiResponse<string>.Fail("Không tìm thấy đăng ký ngựa vào giải này.");

        if (entry.AdminApprovalStatus == "Rejected")
            return ApiResponse<string>.Fail("Đăng ký này đã bị từ chối trước đó.");

        string oldStatus = entry.AdminApprovalStatus;

        // Reject + cascade trong MỘT transaction: enrollment không còn Approved thì
        // pairing/entry của ngựa trong giải đó không được tiếp tục (SCH.1, HRS.6).
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            entry.AdminApprovalStatus = "Rejected";
            entry.RejectionReason = dto.Reason.Trim();
            entry.UpdatedAt = DateTime.UtcNow;

            var activePairings = await _context.Pairings
                .Where(p => p.HorseId == entry.HorseId &&
                            p.TournamentId == entry.TournamentId &&
                            (p.Status == "Pending" || p.Status == "Accepted" || p.Status == "Confirmed"))
                .ToListAsync();
            foreach (var pairing in activePairings)
            {
                pairing.Status = "Cancelled";
                pairing.ResponseReason = "Ngựa đã bị từ chối tham gia giải nên cặp thi đấu bị hủy.";
                pairing.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            // Entry active của pairing bị hủy đi qua withdraw-flow (fee -> Refund Pending,
            // hoàn điểm dự đoán, giải phóng cổng, notification) — không set status tay.
            var cancelledPairingIds = activePairings.Select(p => p.PairingId).ToList();
            foreach (var raceEntryId in await GetActiveEntryIdsAsync(cancelledPairingIds))
            {
                await _raceEntry.WithdrawAsync(adminId, raceEntryId,
                    new RaceEntryDtos.WithdrawEntryDto
                    {
                        Reason = "Ngựa bị từ chối tham gia giải nên đăng ký thi đấu bị hủy."
                    },
                    isSystem: true);
            }

            await _auditLog.LogAsync(
                actorId: adminId,
                action: "Reject_Enrollment",
                entityName: "HorseTournamentEntry",
                entityId: enrollmentId.ToString(),
                oldValue: oldStatus,
                newValue: "Rejected",
                ipAddress: null);

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        await _notification.SendAsync(
            entry.Horse.OwnerId,
            "Ngựa bị từ chối tham gia giải",
            $"Ngựa '{entry.Horse.Name}' bị từ chối tham gia giải '{entry.Tournament.Name}'. Lý do: {dto.Reason}",
            type: "Both",
            relatedEntityType: "HorseTournamentEntry", relatedEntityId: enrollmentId);

        return ApiResponse<string>.Ok("Đã từ chối ngựa tham gia giải.");
    }

    // -------------------------------------------------------------------------
    // PRIVATE HELPERS
    // -------------------------------------------------------------------------

    /// <summary>
    /// Baseline profile-level screen (không cần giải): chỉ chặn doping Failed.
    /// Hồ sơ hợp lệ → dùng được trong kho; gate thật sự để vào giải là enrollment.
    /// </summary>
    private static void ApplyProfileScreening(Horse horse)
    {
        if (horse.DopingTestResult == "Failed")
        {
            horse.ScreeningStatus = "AutoRejected";
            horse.ScreeningReason = "Kết quả kiểm tra doping là Failed.";
            horse.AdminApprovalStatus = "Rejected";
            horse.RejectionReason = horse.ScreeningReason;
        }
        else
        {
            horse.ScreeningStatus = "AutoEligible";
            horse.ScreeningReason = null;
            horse.AdminApprovalStatus = "Approved";
            horse.RejectionReason = null;
        }
    }

    /// <summary>
    /// Screen enrollment theo rule của <paramref name="tournament"/>,
    /// set <see cref="HorseTournamentEntry.ScreeningStatus"/> / ScreeningReason.
    /// Trả về category: "AutoRejected" | "ManualReview" | "AutoEligible".
    /// </summary>
    private static string ScreenEnrollment(Horse horse, Tournament tournament, HorseTournamentEntry entry)
    {
        // Auto-reject cứng — doping Failed. Admin không override.
        if (horse.DopingTestResult == "Failed")
        {
            entry.ScreeningStatus = "AutoRejected";
            entry.ScreeningReason = "Kết quả kiểm tra doping là Failed.";
            return "AutoRejected";
        }

        // Auto-reject cứng — breed mismatch. Admin không override.
        if (!string.Equals(horse.Breed, tournament.AllowedBreed, StringComparison.OrdinalIgnoreCase))
        {
            entry.ScreeningStatus = "AutoRejected";
            entry.ScreeningReason =
                $"Giống ngựa '{horse.Breed}' không khớp giống cho phép '{tournament.AllowedBreed}' của giải.";
            return "AutoRejected";
        }

        // Manual review — doping chưa có kết quả rõ ràng (Pha 3: ManualReview).
        if (horse.DopingTestResult == "Pending")
        {
            entry.ScreeningStatus = "ManualReview";
            entry.ScreeningReason = "Kết quả doping đang chờ (Pending) — cần Admin xem xét.";
            return "ManualReview";
        }

        // Auto eligible — breed khớp, doping Clean, hồ sơ đủ.
        entry.ScreeningStatus = "AutoEligible";
        entry.ScreeningReason = null;
        return "AutoEligible";
    }

    /// <summary>
    /// Ánh xạ category screening → enrollment.AdminApprovalStatus (Pending/Approved/Rejected);
    /// phân biệt auto-reject cứng qua ScreeningStatus = "AutoRejected".
    /// </summary>
    private static void ApplyScreeningToEnrollment(HorseTournamentEntry entry, string category)
    {
        switch (category)
        {
            case "AutoEligible":
                entry.AdminApprovalStatus = "Approved";
                entry.RejectionReason = null;
                break;
            case "AutoRejected":
                entry.AdminApprovalStatus = "Rejected";
                entry.RejectionReason = entry.ScreeningReason;
                break;
            default: // ManualReview
                entry.AdminApprovalStatus = "Pending";
                entry.RejectionReason = null;
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

    private static HorseEnrollmentResponseDto MapToEnrollmentDto(
        HorseTournamentEntry e, Horse horse, Tournament? tournament) => new()
    {
        EnrollmentId = e.EnrollmentId,
        HorseId = e.HorseId,
        HorseName = horse.Name,
        TournamentId = e.TournamentId,
        TournamentName = tournament?.Name,
        Status = e.Status,
        ScreeningStatus = e.ScreeningStatus,
        ScreeningReason = e.ScreeningReason,
        AdminApprovalStatus = e.AdminApprovalStatus,
        RejectionReason = e.RejectionReason,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt
    };

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
        ScreeningStatus = h.ScreeningStatus,
        ScreeningReason = h.ScreeningReason,
        AdminApprovalStatus = h.AdminApprovalStatus,
        RejectionReason = h.RejectionReason,
        CreatedAt = h.CreatedAt,
        UpdatedAt = h.UpdatedAt
    };
    // ── RACE ENTRY ────────────────────────────────────────────────────────────
    // RaceEntry chỉ do Admin tạo qua Module E (POST /api/admin/races/{raceId}/entries).
    // HorseService chỉ còn phục vụ Owner xem danh sách entry của mình.

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

    // Module E — Admin liet ke MOI RaceEntry theo filter (khac pending-fee: khong khoa Unpaid).
    public async Task<ApiResponse<List<RaceEntryResponseDto>>> GetAdminRaceEntriesAsync(
        string? status, string? feeStatus, int? tournamentId, int? raceId, int page, int pageSize)
    {
        var query = _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .Include(e => e.Race).ThenInclude(r => r.Round).ThenInclude(r => r.Tournament)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(e => e.Status == status);
        if (!string.IsNullOrEmpty(feeStatus))
            query = query.Where(e => e.EntryFeeStatus == feeStatus);
        if (tournamentId.HasValue)
            query = query.Where(e => e.Race.Round.TournamentId == tournamentId.Value);
        if (raceId.HasValue)
            query = query.Where(e => e.RaceId == raceId.Value);

        var entries = await query
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
        if (entry == null) return ApiResponse<string>.Fail("Không tìm thấy lượt đăng ký thi đấu này.");
        if (entry.EntryFeeStatus == "Paid") return ApiResponse<string>.Fail("Lệ phí tham gia đã được xác nhận trước đó.");

        // Chỉ xác nhận được lệ phí đang Unpaid của entry còn hiệu lực — không ghi đè
        // trạng thái hoàn phí (Refund Pending/Refunded) và không xác nhận entry đã hủy.
        if (entry.Status == "Cancelled")
            return ApiResponse<string>.Fail("Lượt đăng ký đã bị hủy, không thể xác nhận lệ phí.");
        if (entry.EntryFeeStatus != "Unpaid")
            return ApiResponse<string>.Fail(
                $"Lệ phí đang ở trạng thái '{entry.EntryFeeStatus}', không thể xác nhận lại.");

        var oldFeeStatus = entry.EntryFeeStatus;
        entry.EntryFeeStatus = "Paid";
        entry.EntryFeeConfirmedBy = adminId;
        entry.EntryFeeConfirmedAt = DateTime.UtcNow;
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Update_Entry_Fee_Status", "RaceEntry",
            raceEntryId.ToString(), oldFeeStatus, "Paid", null);

        // Bao Owner: le phi da duoc xac nhan (email + in-app).
        await _notification.SendAsync(
            entry.Pairing.Horse.OwnerId,
            "Lệ phí tham gia đã được xác nhận",
            $"Lệ phí cho ngựa '{entry.Pairing.Horse.Name}' (đăng ký #{raceEntryId}) đã được xác nhận.",
            type: "Both",
            relatedEntityType: "RaceEntry", relatedEntityId: raceEntryId);

        return ApiResponse<string>.Ok("Lệ phí đã được xác nhận.");
    }

    // Module E — dong vong hoan phi: Refund Pending -> Refunded (sau khi Owner rut entry da Paid).
    public async Task<ApiResponse<string>> CompleteRefundAsync(int adminId, int raceEntryId)
    {
        var entry = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);
        if (entry == null) return ApiResponse<string>.Fail("Không tìm thấy lượt đăng ký thi đấu này.");
        if (entry.EntryFeeStatus != "Refund Pending") return ApiResponse<string>.Fail("Lượt đăng ký này hiện không ở trạng thái chờ hoàn phí.");

        entry.EntryFeeStatus = "Refunded";
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Complete_Refund", "RaceEntry",
            raceEntryId.ToString(), "Refund Pending", "Refunded", null);

        await _notification.SendAsync(
            entry.Pairing.Horse.OwnerId,
            "Đã hoàn phí tham gia",
            $"Lệ phí cho ngựa '{entry.Pairing.Horse.Name}' (đăng ký #{raceEntryId}) đã được hoàn.",
            type: "Both",
            relatedEntityType: "RaceEntry", relatedEntityId: raceEntryId);

        return ApiResponse<string>.Ok("Đã hoàn phí tham gia.");
    }

    public async Task<ApiResponse<string>> ApproveRaceEntryAsync(int adminId, int raceEntryId)
    {
        var entry = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(e => e.Race).ThenInclude(r => r.Round).ThenInclude(r => r.Tournament)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);

        if (entry == null) return ApiResponse<string>.Fail("Không tìm thấy lượt đăng ký thi đấu này.");
        if (entry.EntryFeeStatus != "Paid") return ApiResponse<string>.Fail("Lệ phí tham gia của lượt đăng ký này chưa được thanh toán.");

        // Schema v3: gate theo enrollment của ĐÚNG giải (duyệt lại mỗi giải), không phải hồ sơ ngựa.
        var enrollmentApproved = await _context.HorseTournamentEntries.AnyAsync(e =>
            e.HorseId == entry.Pairing.HorseId &&
            e.TournamentId == entry.Pairing.TournamentId &&
            e.AdminApprovalStatus == "Approved");
        if (!enrollmentApproved)
            return ApiResponse<string>.Fail("Ngựa chưa được duyệt tham gia giải này.");

        if (entry.Status == "Confirmed") return ApiResponse<string>.Fail("Lượt đăng ký này đã được xác nhận trước đó.");

        // Breed check — có Tournament context tại đây
        string allowedBreed = entry.Race.Round.Tournament.AllowedBreed;
        if (entry.Pairing.Horse.Breed != allowedBreed)
            return ApiResponse<string>.Fail($"Giống ngựa không phù hợp: giải yêu cầu giống '{allowedBreed}', ngựa của bạn thuộc giống '{entry.Pairing.Horse.Breed}'.");

        entry.Status = "Confirmed";
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Approve_RaceEntry", "RaceEntry",
            raceEntryId.ToString(), "Pending", "Confirmed", null);

        await _notification.SendAsync(
            entry.Pairing.Horse.OwnerId,
            "Đăng ký race được xác nhận",
            $"Đăng ký #{raceEntryId} cho ngựa '{entry.Pairing.Horse.Name}' đã được Admin xác nhận tham gia cuộc đua.",
            type: "Both",
            relatedEntityType: "RaceEntry", relatedEntityId: raceEntryId);

        return ApiResponse<string>.Ok("Đăng ký tham gia cuộc đua đã được xác nhận.");
    }

    public async Task<ApiResponse<string>> RejectRaceEntryAsync(int adminId, int raceEntryId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 10)
            return ApiResponse<string>.Fail("Lý do từ chối phải có ít nhất 10 ký tự.");

        var entry = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);
        if (entry == null) return ApiResponse<string>.Fail("Không tìm thấy lượt đăng ký thi đấu này.");
        if (entry.Status == "Cancelled") return ApiResponse<string>.Fail("Lượt đăng ký này đã bị hủy trước đó.");

        string oldStatus = entry.Status;

        // Từ chối = đi qua withdraw-flow dùng chung (CHK_RaceEntries_Status không có
        // "Rejected"): fee Paid -> Refund Pending, hoàn điểm dự đoán, giải phóng
        // PostPosition, notification — không set status tay nữa.
        RaceEntryDtos.WithdrawResultDto result;
        try
        {
            result = await _raceEntry.WithdrawAsync(adminId, raceEntryId,
                new RaceEntryDtos.WithdrawEntryDto { Reason = reason.Trim() }, isSystem: true);
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UPCOMING")
        {
            return ApiResponse<string>.Fail("Cuộc đua đã bắt đầu hoặc kết thúc, không thể từ chối đăng ký.");
        }

        if (result.AlreadyWithdrawn)
            return ApiResponse<string>.Fail("Lượt đăng ký này đã bị hủy trước đó.");

        await _auditLog.LogAsync(adminId, "Reject_RaceEntry", "RaceEntry",
            raceEntryId.ToString(), oldStatus, $"Cancelled: {reason}", null);

        await _notification.SendAsync(
            entry.Pairing.Horse.OwnerId,
            "Đăng ký race bị từ chối",
            $"Đăng ký #{raceEntryId} cho ngựa '{entry.Pairing.Horse.Name}' bị từ chối. Lý do: {reason}",
            type: "Both",
            relatedEntityType: "RaceEntry", relatedEntityId: raceEntryId);

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
