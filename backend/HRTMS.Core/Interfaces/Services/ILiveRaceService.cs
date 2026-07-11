using HRTMS.Core.DTOs.LiveRace;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services
{
    /// <summary>
    /// Module H mở rộng — UI-S07 Live Race Simulation (BE side).
    /// Không tính toán / lưu vị trí % của ngựa trong lúc chạy (animation thuần
    /// client-side). BE chỉ cấp trạng thái, actualStartTime, kết quả cuối
    /// (FinishPosition) và violation ghi nhận trong lúc Live.
    /// </summary>
    public interface ILiveRaceService
    {
        // Public — Owner/Jockey/Spectator xem trạng thái + danh sách entry để render chip ngựa.
        Task<LiveRaceStatusDto> GetLiveStatusAsync(int raceId);

        // Referee (Lead/Assistant được assign) bấm "Start Race": Upcoming/Pre-Race -> Live.
        Task<StartRaceResultDto> StartRaceAsync(int raceId, int refereeId);

        // Referee ghi nhận vi phạm trong lúc race đang Live (Module H).
        Task<ViolationDto> RecordViolationAsync(int raceId, int refereeId, CreateViolationDto dto);

        // Public/Owner/Spectator poll riêng (3-5s), tách khỏi tick animation 100ms.
        Task<List<ViolationDto>> GetViolationsAsync(int raceId);

        // Referee chốt sơ bộ FinishPosition, chuyển Live -> Unofficial.
        Task<SubmitFinishResultsResultDto> SubmitFinishResultsAsync(int raceId, int refereeId, SubmitFinishResultsDto dto);
    }
}
