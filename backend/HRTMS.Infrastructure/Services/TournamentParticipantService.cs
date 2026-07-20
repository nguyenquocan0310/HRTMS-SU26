using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Participant;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class TournamentParticipantService : ITournamentParticipantService
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLog;
    private readonly INotificationService _notification;

    private static readonly string[] AllowedRoles = ["Owner", "Jockey", "Doctor", "Referee"];

    private sealed record ScreeningDecision(
        string ParticipantStatus,
        string ScreeningStatus,
        string ScreeningReason,
        string? RejectionReason,
        bool ApprovedImmediately,
        string SuccessMessage);

    public TournamentParticipantService(HRTMSDbContext context, IAuditLogService auditLog, INotificationService notification)
    {
        _context = context;
        _auditLog = auditLog;
        _notification = notification;
    }

    public async Task<ApiResponse<ParticipantResponseDto>> RegisterAsync(int userId, string role, int tournamentId)
    {
        if (!AllowedRoles.Contains(role))
            return ApiResponse<ParticipantResponseDto>.Fail("Chỉ Owner/Jockey/Doctor/Referee mới đăng ký tham gia giải được.");

        var tournament = await _context.Tournaments.FindAsync(tournamentId);
        if (tournament == null)
            return ApiResponse<ParticipantResponseDto>.Fail("Không tìm thấy giải đấu này.");

        // Chỉ nhận đăng ký khi giải đang mở đăng ký
        if (tournament.Status != "Open Registration")
            return ApiResponse<ParticipantResponseDto>.Fail("Giải hiện không mở đăng ký.");

        // Chặn đăng ký trùng (UNIQUE TournamentId + UserId)
        var existing = await _context.TournamentParticipants
            .FirstOrDefaultAsync(p => p.TournamentId == tournamentId && p.UserId == userId);
        if (existing != null)
            return ApiResponse<ParticipantResponseDto>.Fail("Bạn đã đăng ký tham gia giải này rồi.");

        // Jockey chỉ được tham gia 1 giải chưa kết thúc tại một thời điểm (nhóm chốt).
        // CHỈ áp cho Jockey — Owner/Doctor/Referee được phục vụ nhiều giải song song.
        // Bản ghi 'Rejected' không tính là đang tham gia; chỉ giải Open/Closed
        // Registration mới là "chưa kết thúc" (Completed/Cancelled = đã xong).
        if (role == "Jockey")
        {
            var activeElsewhere = await _context.TournamentParticipants
                .Include(p => p.Tournament)
                .AnyAsync(p =>
                    p.UserId == userId &&
                    p.Role == "Jockey" &&
                    p.TournamentId != tournamentId &&
                    p.Status != "Rejected" &&
                    (p.Tournament.Status == "Open Registration" ||
                     p.Tournament.Status == "Closed Registration"));
            if (activeElsewhere)
                return ApiResponse<ParticipantResponseDto>.Fail(
                    "Bạn đang tham gia một giải chưa kết thúc nên chưa thể đăng ký thêm giải mới.");
        }

        var now = DateTime.UtcNow;
        var decision = await BuildScreeningDecisionAsync(userId, role, tournament);
        if (decision == null)
            return ApiResponse<ParticipantResponseDto>.Fail("Không tìm thấy tài khoản người dùng.");

        var participant = new TournamentParticipant
        {
            TournamentId = tournamentId,
            UserId = userId,
            Role = role,
            RegisteredAt = now,
            Status = decision.ParticipantStatus,
            ScreeningStatus = decision.ScreeningStatus,
            ScreeningReason = decision.ScreeningReason,
            RejectionReason = decision.RejectionReason,
            ApprovedAt = decision.ApprovedImmediately ? now : null
        };

        // Auto-screening roster:
        // - Owner Active đăng ký thành công → AutoEligible + Approved ngay, KHÔNG vào Admin approval queue.
        // - Jockey/Referee/Doctor Active + đủ điều kiện → AutoEligible, Status = Pending cho bulk approval.
        // - Dữ liệu mơ hồ → ManualReview; vi phạm cứng → AutoRejected + Rejected.

        _context.TournamentParticipants.Add(participant);
        await _context.SaveChangesAsync();

        if (participant.Status == "Rejected")
        {
            await _notification.SendAsync(
                userId,
                "Đăng ký giải bị từ chối tự động",
                participant.RejectionReason ?? participant.ScreeningReason,
                type: "Both",
                relatedEntityType: "TournamentParticipant",
                relatedEntityId: participant.ParticipantId);
        }

        await _auditLog.LogAsync(userId, "Đăng ký nhân sự điều hành giải", "TournamentParticipant",
            participant.ParticipantId.ToString(), null,
            $"Tournament={tournamentId}, Role={role}, Screening={participant.ScreeningStatus}, Status={participant.Status}");

        return ApiResponse<ParticipantResponseDto>.Ok(
            await MapByIdAsync(participant.ParticipantId),
            decision.SuccessMessage);
    }

    public async Task<ApiResponse<List<ParticipantResponseDto>>> GetRosterAsync(
        int tournamentId, string? role, string? status)
    {
        var query = _context.TournamentParticipants
            .Include(p => p.User)
            .Include(p => p.Tournament)
            .Where(p => p.TournamentId == tournamentId);

        if (!string.IsNullOrEmpty(role))
            query = query.Where(p => p.Role == role);
        if (!string.IsNullOrEmpty(status))
            query = query.Where(p => p.Status == status);

        var data = await query
            .OrderBy(p => p.Role).ThenByDescending(p => p.RegisteredAt)
            .Select(p => MapToDto(p))
            .ToListAsync();

        return ApiResponse<List<ParticipantResponseDto>>.Ok(data);
    }

    public async Task<ApiResponse<List<ParticipantResponseDto>>> GetMyParticipationsAsync(int userId)
    {
        var data = await _context.TournamentParticipants
            .Include(p => p.User)
            .Include(p => p.Tournament)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.RegisteredAt)
            .Select(p => MapToDto(p))
            .ToListAsync();

        return ApiResponse<List<ParticipantResponseDto>>.Ok(data);
    }

    public async Task<ApiResponse<ParticipantResponseDto>> ApproveAsync(int adminId, int participantId)
    {
        var participant = await _context.TournamentParticipants.FindAsync(participantId);
        if (participant == null)
            return ApiResponse<ParticipantResponseDto>.Fail("Không tìm thấy đăng ký tham gia này.");
        if (participant.Status == "Approved")
            return ApiResponse<ParticipantResponseDto>.Fail("Đăng ký này đã được duyệt.");

        string oldStatus = participant.Status;
        participant.Status = "Approved";
        participant.ApprovedBy = adminId;
        participant.ApprovedAt = DateTime.UtcNow;
        participant.RejectionReason = null;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Duyệt nhân sự điều hành giải", "TournamentParticipant",
            participantId.ToString(), oldStatus, "Approved");

        await _notification.SendAsync(
            participant.UserId,
            "Đăng ký tham gia giải được duyệt",
            $"Đăng ký tham gia giải (vai trò {participant.Role}) của bạn đã được Admin phê duyệt.",
            type: "Both",
            relatedEntityType: "TournamentParticipant",
            relatedEntityId: participantId);

        return ApiResponse<ParticipantResponseDto>.Ok(
            await MapByIdAsync(participantId), "Đã duyệt tham gia giải.");
    }

    public async Task<ApiResponse<ParticipantResponseDto>> RejectAsync(int adminId, int participantId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 10)
            return ApiResponse<ParticipantResponseDto>.Fail("Lý do từ chối phải có ít nhất 10 ký tự.");

        var participant = await _context.TournamentParticipants.FindAsync(participantId);
        if (participant == null)
            return ApiResponse<ParticipantResponseDto>.Fail("Không tìm thấy đăng ký tham gia này.");
        if (participant.Status == "Rejected")
            return ApiResponse<ParticipantResponseDto>.Fail("Đăng ký này đã bị từ chối.");

        string oldStatus = participant.Status;
        participant.Status = "Rejected";
        participant.RejectionReason = reason.Trim();
        participant.ApprovedBy = adminId;
        participant.ApprovedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Từ chối nhân sự điều hành giải", "TournamentParticipant",
            participantId.ToString(), oldStatus, $"Rejected: {reason.Trim()}");

        await _notification.SendAsync(
            participant.UserId,
            "Đăng ký tham gia giải bị từ chối",
            $"Đăng ký tham gia giải (vai trò {participant.Role}) của bạn đã bị từ chối. Lý do: {reason.Trim()}",
            type: "Both",
            relatedEntityType: "TournamentParticipant",
            relatedEntityId: participantId);

        return ApiResponse<ParticipantResponseDto>.Ok(
            await MapByIdAsync(participantId), "Đã từ chối tham gia giải.");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<ScreeningDecision?> BuildScreeningDecisionAsync(int userId, string role, Tournament tournament)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
            return null;

        if (user.Role != role)
            return AutoRejected($"Vai trò tài khoản ({user.Role}) không khớp với vai trò đăng ký ({role}).");

        if (user.Status != "Active")
            return AutoRejected("Tài khoản của bạn chưa được kích hoạt nên chưa đủ điều kiện tham gia giải.");

        switch (role)
        {
            case "Owner":
                var ownerOk = await _context.OwnerProfiles.AnyAsync(o => o.OwnerId == userId);
                return ownerOk
                    ? new ScreeningDecision(
                        "Approved",
                        "AutoEligible",
                        "Tài khoản đã kích hoạt và có hồ sơ chủ ngựa nên tự động đủ điều kiện tham gia.",
                        null,
                        true,
                        "Đăng ký tham gia giải thành công, bạn đã được tự động phê duyệt.")
                    : AutoRejected("Bạn cần hoàn thiện hồ sơ chủ ngựa trước.");

            case "Jockey":
                var jockey = await _context.JockeyProfiles.FirstOrDefaultAsync(j => j.JockeyId == userId);
                if (jockey == null) return AutoRejected("Bạn cần khai báo hồ sơ Jockey trước.");
                if (jockey.Status != "Active") return AutoRejected("Hồ sơ Jockey của bạn chưa được Admin kích hoạt.");
                if (string.IsNullOrWhiteSpace(jockey.LicenseCertificate))
                    return AutoRejected("Bạn chưa cung cấp chứng chỉ hành nghề bắt buộc.");
                if (!HasRequiredIdentity(user))
                    return AutoRejected("Bạn chưa cung cấp đầy đủ thông tin định danh, số điện thoại hoặc ngày sinh.");
                if (jockey.ExperienceYears < tournament.MinJockeyExperienceYears)
                    return AutoRejected($"Bạn cần có ít nhất {tournament.MinJockeyExperienceYears} năm kinh nghiệm để đăng ký giải này.");
                if (jockey.SelfDeclaredWeight <= 0)
                    return ManualReview("Bạn chưa khai báo cân nặng hợp lệ trong hồ sơ.");
                if (!string.IsNullOrWhiteSpace(jockey.HealthStatus) && jockey.HealthStatus != "Good")
                    return ManualReview($"Tình trạng sức khỏe của bạn cần Admin xem xét thêm: {jockey.HealthStatus}.");
                return AutoEligible("Hồ sơ Jockey đã được kích hoạt, đủ thông tin định danh, chứng chỉ hành nghề và đạt kinh nghiệm tối thiểu.");

            case "Doctor":
                var doctor = await _context.DoctorProfiles.FirstOrDefaultAsync(d => d.DoctorId == userId);
                if (doctor == null) return AutoRejected("Bạn cần khai báo hồ sơ Doctor trước.");
                if (doctor.Status != "Active") return AutoRejected("Hồ sơ Doctor của bạn chưa được Admin kích hoạt.");
                if (!HasRequiredIdentity(user))
                    return AutoRejected("Bạn chưa cung cấp đầy đủ thông tin định danh, số điện thoại hoặc ngày sinh.");
                if (string.IsNullOrWhiteSpace(doctor.MedicalLicenseNumber))
                    return ManualReview("Bạn chưa cung cấp mã giấy phép hành nghề y rõ ràng.");
                return AutoEligible("Hồ sơ Doctor đã được kích hoạt, đủ thông tin định danh và giấy phép hành nghề y.");

            case "Referee":
                var referee = await _context.RefereeProfiles.FirstOrDefaultAsync(r => r.RefereeId == userId);
                if (referee == null) return AutoRejected("Bạn cần khai báo hồ sơ Referee trước.");
                if (referee.Status != "Active") return AutoRejected("Hồ sơ Referee của bạn chưa được Admin kích hoạt.");
                if (!HasRequiredIdentity(user))
                    return AutoRejected("Bạn chưa cung cấp đầy đủ thông tin định danh, số điện thoại hoặc ngày sinh.");
                if (string.IsNullOrWhiteSpace(referee.CertificationLevel))
                    return ManualReview("Bạn chưa cung cấp cấp chứng nhận trọng tài rõ ràng.");
                return AutoEligible("Hồ sơ Referee đã được kích hoạt, đủ thông tin định danh và chứng nhận.");

            default:
                return AutoRejected("Vai trò không hợp lệ.");
        }
    }

    private static bool HasRequiredIdentity(User user) =>
        user.IdentityHash != null
        && !string.IsNullOrWhiteSpace(user.PhoneNumber)
        && user.DateOfBirth != null;

    private static ScreeningDecision AutoEligible(string reason) => new(
        "Pending",
        "AutoEligible",
        $"{reason} Chờ Admin duyệt cuối.",
        null,
        false,
        "Đăng ký tham gia giải thành công, chờ Admin duyệt.");

    private static ScreeningDecision ManualReview(string reason) => new(
        "ManualReview",
        "ManualReview",
        reason,
        null,
        false,
        $"Đăng ký tham gia giải cần Admin xem xét: {reason}");

    private static ScreeningDecision AutoRejected(string reason) => new(
        "Rejected",
        "AutoRejected",
        reason,
        reason,
        false,
        $"Đăng ký tham gia giải bị tự động từ chối: {reason}");

    private async Task<ParticipantResponseDto> MapByIdAsync(int participantId)
    {
        var p = await _context.TournamentParticipants
            .Include(x => x.User)
            .Include(x => x.Tournament)
            .FirstAsync(x => x.ParticipantId == participantId);
        return MapToDto(p);
    }

    private static ParticipantResponseDto MapToDto(TournamentParticipant p) => new()
    {
        ParticipantId = p.ParticipantId,
        TournamentId = p.TournamentId,
        TournamentName = p.Tournament != null ? p.Tournament.Name : null,
        UserId = p.UserId,
        FullName = p.User != null ? p.User.FullName : string.Empty,
        Email = p.User != null ? p.User.Email : string.Empty,
        PhoneNumber = p.User != null ? p.User.PhoneNumber : null,
        DateOfBirth = p.User != null ? p.User.DateOfBirth : null,
        Role = p.Role,
        Status = p.Status,
        ScreeningStatus = p.ScreeningStatus,
        ScreeningReason = p.ScreeningReason,
        RejectionReason = p.RejectionReason,
        RegisteredAt = p.RegisteredAt,
        ApprovedAt = p.ApprovedAt
    };
}