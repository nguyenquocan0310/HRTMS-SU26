using HRTMS.Core.DTOs.RaceEntry;

namespace HRTMS.Core.Interfaces.Services;

// Module E — Lập lịch, Bốc thăm & Rút lui.
public interface IRaceEntryService
{
    // Admin phân bổ Pairing (Accepted) vào Race, tạo RaceEntry.
    // Cưỡng chế: cửa sổ thời gian, MaxHorses, double-booking & trùng trong Race.
    Task<RaceEntryResponseDto> AllocateAsync(int adminId, int raceId, AllocateEntryDto dto);

    // Bốc thăm vị trí xuất phát nguyên tử trong một transaction.
    Task<PostPositionDrawResultDto> DrawPostPositionsAsync(int adminId, int raceId);

    // Lấy lịch thi đấu công khai (không yêu cầu đăng nhập).
    Task<RaceScheduleDto> GetRaceScheduleAsync(int raceId);

    // Owner xác nhận tham gia trước Confirmation Cut-off.
    Task<RaceEntryResponseDto> ConfirmAsync(int ownerId, int raceEntryId);

    // Withdrawal Flow (Owner rút hoặc hệ thống cancel khi quá hạn).
    // Idempotent: gọi lại khi đã Cancelled không gây tác động phụ.
    Task<WithdrawResultDto> WithdrawAsync(int actorId, int raceEntryId, WithdrawEntryDto dto, bool isSystem = false);

    // Job nén (Hangfire): tự động cancel các entry quá Confirmation Cut-off mà chưa xác nhận.
    // Trả về số entry đã bị cancel.
    Task<int> AutoCancelOverdueAsync();

    // Guard đóng băng cấu hình Race. Gọi trước khi sửa ScheduledTime /
    // RaceDistanceOverride / TrackTypeOverride. Throw "RACE_CONFIG_FROZEN" nếu đã bốc thăm hoặc đã có Prediction.
    Task EnsureRaceConfigEditableAsync(int raceId);
}
