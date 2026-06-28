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

    private static readonly string[] AllowedRoles = ["Owner", "Jockey", "Doctor", "Referee"];

    public TournamentParticipantService(HRTMSDbContext context, IAuditLogService auditLog)
    {
        _context = context;
        _auditLog = auditLog;
    }

    public async Task<ApiResponse<ParticipantResponseDto>> RegisterAsync(int userId, string role, int tournamentId)
    {
        if (!AllowedRoles.Contains(role))
            return ApiResponse<ParticipantResponseDto>.Fail("Chỉ Owner/Jockey/Doctor/Referee mới đăng ký tham gia giải được.");

        var tournament = await _context.Tournaments.FindAsync(tournamentId);
        if (tournament == null)
            return ApiResponse<ParticipantResponseDto>.Fail("TOURNAMENT_NOT_FOUND");

        // Chỉ nhận đăng ký khi giải đang mở đăng ký
        if (tournament.Status != "Open Registration")
            return ApiResponse<ParticipantResponseDto>.Fail("Giải không ở trạng thái mở đăng ký.");

        // Chứng chỉ/bằng cấp phải được duyệt GLOBAL (Module A) trước khi vào giải
        var credentialError = await ValidateGlobalCredentialAsync(userId, role);
        if (credentialError != null)
            return ApiResponse<ParticipantResponseDto>.Fail(credentialError);

        // Chặn đăng ký trùng (UNIQUE TournamentId + UserId)
        var existing = await _context.TournamentParticipants
            .FirstOrDefaultAsync(p => p.TournamentId == tournamentId && p.UserId == userId);
        if (existing != null)
            return ApiResponse<ParticipantResponseDto>.Fail("Bạn đã đăng ký tham gia giải này rồi.");

        var now = DateTime.UtcNow;
        var participant = new TournamentParticipant
        {
            TournamentId = tournamentId,
            UserId = userId,
            Role = role,
            RegisteredAt = now,
            ScreeningStatus = "AutoEligible"
        };

        // TRN.11 — Auto-screening roster:
        // - Owner Active đăng ký thành công → AutoEligible + Approved ngay, KHÔNG vào Admin approval queue (AC#3).
        // - Jockey/Referee/Doctor đã Active (đã qua ValidateGlobalCredentialAsync) → AutoEligible nhưng
        //   chỉ vào bulk approval queue, Status = Pending cho tới khi Admin duyệt (AC#4, AC#5).
        string successMessage;
        if (role == "Owner")
        {
            participant.Status = "Approved";
            participant.ApprovedAt = now;
            participant.ScreeningReason = "Owner Active → tự động đủ điều kiện tham gia.";
            successMessage = "Đăng ký tham gia giải thành công, bạn đã được tự động phê duyệt.";
        }
        else
        {
            participant.Status = "Pending";
            participant.ScreeningReason = "Hồ sơ Active → đủ điều kiện sơ bộ, chờ Admin duyệt cuối.";
            successMessage = "Đăng ký tham gia giải thành công, chờ Admin duyệt.";
        }

        _context.TournamentParticipants.Add(participant);
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(userId, "Register_TournamentParticipant", "TournamentParticipant",
            participant.ParticipantId.ToString(), null,
            $"Tournament={tournamentId}, Role={role}, Screening=AutoEligible, Status={participant.Status}");

        return ApiResponse<ParticipantResponseDto>.Ok(
            await MapByIdAsync(participant.ParticipantId),
            successMessage);
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
            return ApiResponse<ParticipantResponseDto>.Fail("PARTICIPANT_NOT_FOUND");
        if (participant.Status == "Approved")
            return ApiResponse<ParticipantResponseDto>.Fail("Đăng ký này đã được duyệt.");

        string oldStatus = participant.Status;
        participant.Status = "Approved";
        participant.ApprovedBy = adminId;
        participant.ApprovedAt = DateTime.UtcNow;
        participant.RejectionReason = null;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Approve_TournamentParticipant", "TournamentParticipant",
            participantId.ToString(), oldStatus, "Approved");

        return ApiResponse<ParticipantResponseDto>.Ok(
            await MapByIdAsync(participantId), "Đã duyệt tham gia giải.");
    }

    public async Task<ApiResponse<ParticipantResponseDto>> RejectAsync(int adminId, int participantId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 10)
            return ApiResponse<ParticipantResponseDto>.Fail("Lý do từ chối phải có ít nhất 10 ký tự.");

        var participant = await _context.TournamentParticipants.FindAsync(participantId);
        if (participant == null)
            return ApiResponse<ParticipantResponseDto>.Fail("PARTICIPANT_NOT_FOUND");
        if (participant.Status == "Rejected")
            return ApiResponse<ParticipantResponseDto>.Fail("Đăng ký này đã bị từ chối.");

        string oldStatus = participant.Status;
        participant.Status = "Rejected";
        participant.RejectionReason = reason.Trim();
        participant.ApprovedBy = adminId;
        participant.ApprovedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(adminId, "Reject_TournamentParticipant", "TournamentParticipant",
            participantId.ToString(), oldStatus, $"Rejected: {reason.Trim()}");

        return ApiResponse<ParticipantResponseDto>.Ok(
            await MapByIdAsync(participantId), "Đã từ chối tham gia giải.");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /// <summary>Trả về null nếu credential global hợp lệ, ngược lại trả về thông báo lỗi.</summary>
    private async Task<string?> ValidateGlobalCredentialAsync(int userId, string role)
    {
        switch (role)
        {
            case "Owner":
                var ownerOk = await _context.OwnerProfiles.AnyAsync(o => o.OwnerId == userId);
                return ownerOk ? null : "Bạn cần hoàn thiện hồ sơ chủ ngựa trước.";
            case "Jockey":
                var jockey = await _context.JockeyProfiles.FirstOrDefaultAsync(j => j.JockeyId == userId);
                if (jockey == null) return "Bạn cần khai báo hồ sơ Jockey trước.";
                return jockey.Status == "Active" ? null : "Hồ sơ Jockey chưa được Admin duyệt (Active).";
            case "Doctor":
                var doctor = await _context.DoctorProfiles.FirstOrDefaultAsync(d => d.DoctorId == userId);
                if (doctor == null) return "Bạn cần khai báo hồ sơ Doctor trước.";
                return doctor.Status == "Active" ? null : "Hồ sơ Doctor chưa được Admin duyệt (Active).";
            case "Referee":
                var referee = await _context.RefereeProfiles.FirstOrDefaultAsync(r => r.RefereeId == userId);
                if (referee == null) return "Bạn cần khai báo hồ sơ Referee trước.";
                return referee.Status == "Active" ? null : "Hồ sơ Referee chưa được Admin duyệt (Active).";
            default:
                return "Role không hợp lệ.";
        }
    }

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
        Role = p.Role,
        Status = p.Status,
        ScreeningStatus = p.ScreeningStatus,
        ScreeningReason = p.ScreeningReason,
        RejectionReason = p.RejectionReason,
        RegisteredAt = p.RegisteredAt,
        ApprovedAt = p.ApprovedAt
    };
}
