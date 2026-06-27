using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Participant;

namespace HRTMS.Core.Interfaces.Services;

public interface ITournamentParticipantService
{
    /// <summary>Người dùng (Owner/Jockey/Doctor/Referee) tự đăng ký tham gia một giải → Status=Pending.</summary>
    Task<ApiResponse<ParticipantResponseDto>> RegisterAsync(int userId, string role, int tournamentId);

    /// <summary>Roster của giải, lọc tuỳ chọn theo role và status.</summary>
    Task<ApiResponse<List<ParticipantResponseDto>>> GetRosterAsync(int tournamentId, string? role, string? status);

    /// <summary>Các giải mà người dùng hiện tại đã đăng ký (mọi trạng thái).</summary>
    Task<ApiResponse<List<ParticipantResponseDto>>> GetMyParticipationsAsync(int userId);

    /// <summary>Admin duyệt một đăng ký tham gia giải → Approved.</summary>
    Task<ApiResponse<ParticipantResponseDto>> ApproveAsync(int adminId, int participantId);

    /// <summary>Admin từ chối một đăng ký tham gia giải → Rejected (kèm lý do ≥10 ký tự).</summary>
    Task<ApiResponse<ParticipantResponseDto>> RejectAsync(int adminId, int participantId, string reason);
}
