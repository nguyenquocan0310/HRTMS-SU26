using HRTMS.Core.DTOs.RaceEntry;

namespace HRTMS.Core.Interfaces.Services;

// Module E — Lap lich, Boc tham & Rut lui (REQ-F-SCH).
public interface IRaceEntryService
{
    // SCH.1 — Admin phan bo Pairing (Accepted) vao Race, tao RaceEntry.
    // Cuong che: SCH.6 (cua so thoi gian), SCH.7 (MaxHorses), SCH.8 (double-booking & trung trong Race).
    Task<RaceEntryResponseDto> AllocateAsync(int adminId, int raceId, AllocateEntryDto dto);

    // SCH.2 — Boc tham vi tri xuat phat nguyen tu trong mot transaction.
    Task<PostPositionDrawResultDto> DrawPostPositionsAsync(int adminId, int raceId);

    // SCH.3 — Lay lich thi dau cong khai (khong yeu cau dang nhap).
    Task<RaceScheduleDto> GetRaceScheduleAsync(int raceId);

    // SCH.4 — Owner xac nhan tham gia truoc Confirmation Cut-off.
    Task<RaceEntryResponseDto> ConfirmAsync(int ownerId, int raceEntryId);

    // SCH.5 — Withdrawal Flow (Owner rut hoac he thong cancel khi qua han).
    // Idempotent: goi lai khi da Cancelled khong gay tac dong phu.
    Task<WithdrawResultDto> WithdrawAsync(int actorId, int raceEntryId, WithdrawEntryDto dto, bool isSystem = false);

    // SCH.5 — Job nen (Hangfire): tu dong cancel cac entry qua Confirmation Cut-off ma chua xac nhan.
    // Tra ve so entry da bi cancel.
    Task<int> AutoCancelOverdueAsync();

    // SCH.9 — Guard dong bang cau hinh Race. Goi truoc khi sua ScheduledTime /
    // RaceDistanceOverride / TrackTypeOverride. Throw "RACE_CONFIG_FROZEN" neu da boc tham hoac da co Prediction.
    Task EnsureRaceConfigEditableAsync(int raceId);
}
