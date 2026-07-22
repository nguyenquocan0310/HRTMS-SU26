using HRTMS.Core.DTOs.RaceEntry;

namespace HRTMS.Core.Interfaces.Services;

// Module E — Lập lịch, Bốc thăm & Rút lui.
public interface IRaceEntryService
{
    // Admin phân bổ Pairing (Accepted) vào Race, tạo RaceEntry.
    // Cưỡng chế: cửa sổ thời gian, MaxHorses, double-booking & trùng trong Race.
    Task<RaceEntryResponseDto> AllocateAsync(int adminId, int raceId, AllocateEntryDto dto);

    // Tự động phân bổ TOÀN BỘ pool đủ điều kiện vào các race của một vòng.
    // Round 1: pairing Confirmed + lệ phí Verified. Round 2+: entry Qualified/
    // AlsoEligible ở vòng trước. Sức chứa mỗi race = min(MaxHorses, Venue.LaneCount).
    // Một transaction; gọi lại khi vòng đã allocate -> ROUND_ALREADY_ALLOCATED.
    Task<AutoAllocateResultDto> AutoAllocateRoundAsync(int actorId, int roundId);

    // Dry-run: dùng chung guard/pool/sức chứa với AutoAllocateRoundAsync nhưng
    // KHÔNG ghi DB. Races[].Entries để rỗng vì mapping ngựa→race chỉ chốt lúc thật
    // (Fisher-Yates); xem AssignmentIsFinal.
    Task<AutoAllocateResultDto> PreviewAllocateRoundAsync(int roundId);

    // Danh sách chờ đã persist của một vòng (bảng RoundWaitlist, patch 014).
    Task<List<AutoAllocateWaitlistDto>> GetRoundWaitlistAsync(int roundId);

    // Manual override: chuyển entry sang race khác TRONG CÙNG vòng, race đích
    // chưa bốc thăm và còn chỗ.
    Task<RaceEntryResponseDto> MoveEntryAsync(int adminId, int raceEntryId, int targetRaceId);

    // Chốt vòng: auto-allocate rồi bốc thăm mọi race đủ điều kiện.
    // KHÔNG phải một transaction duy nhất — xem chú thích ở implementation.
    Task<FinalizeRoundResultDto> FinalizeRoundAsync(int actorId, int roundId);

    // Bốc thăm vị trí xuất phát nguyên tử trong một transaction.
    Task<PostPositionDrawResultDto> DrawPostPositionsAsync(int adminId, int raceId);

    // Job nén (Hangfire): auto-allocate vòng 1 của giải đã quá PaymentDeadline.
    Task<int> AutoAllocateDueRoundsAsync();

    // Job nén (Hangfire): bốc thăm race Upcoming sắp chạy (<= 24h) đã đủ điều kiện.
    Task<int> AutoDrawDueRacesAsync();

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

    // Admin hủy một cuộc đua chưa Official (SCH.9): entry active đi qua withdraw-flow
    // (fee Refund Pending, hoàn điểm dự đoán, giải phóng cổng, notification) trong
    // một transaction. Throw "RACE_ALREADY_OFFICIAL" / "RACE_ALREADY_CANCELLED".
    Task<CancelRaceResultDto> CancelRaceAsync(int adminId, int raceId, string? reason);

    // Guard đóng băng cấu hình Race. Gọi trước khi sửa ScheduledTime /
    // RaceDistanceOverride / TrackTypeOverride. Throw "RACE_CONFIG_FROZEN" nếu đã bốc thăm hoặc đã có Prediction.
    Task EnsureRaceConfigEditableAsync(int raceId);
}
