using System.Collections.Generic;

namespace HRTMS.Core.DTOs.RaceEntry;

// Kết quả gỡ phân bổ của cả một vòng — đưa vòng về trạng thái trước khi
// auto-allocate chạy, để Admin phân lại sau khi sửa cấu hình.
public class ClearAllocationResultDto
{
    public int RoundId { get; set; }

    public int TournamentId { get; set; }

    // Số RaceEntry đã xoá hẳn (không phải huỷ) — entry sinh ra từ phân bổ, chưa
    // đua, nên xoá để vòng trở lại đúng trạng thái "chưa phân bổ".
    public int RemovedEntryCount { get; set; }

    // Số dòng danh sách chờ đã xoá; lần phân bổ sau sẽ tính lại từ đầu.
    public int RemovedWaitlistCount { get; set; }

    // Cặp đấu được giải phóng, để FE hiển thị "đã trả về danh sách chờ phân".
    public List<ClearedPairingDto> ReleasedPairings { get; set; } = new();
}

public class ClearedPairingDto
{
    public int PairingId { get; set; }

    public int RaceId { get; set; }

    public int RaceNumber { get; set; }

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public string JockeyName { get; set; } = string.Empty;
}
