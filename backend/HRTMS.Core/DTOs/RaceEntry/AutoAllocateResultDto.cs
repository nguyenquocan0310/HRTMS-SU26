namespace HRTMS.Core.DTOs.RaceEntry;

// Kết quả auto-allocate một vòng đấu (patch 012/Module E).
public class AutoAllocateResultDto
{
    public int RoundId { get; set; }

    public int TournamentId { get; set; }

    // Tổng số pairing/entry đủ điều kiện trong pool trước khi cắt theo sức chứa.
    public int PoolSize { get; set; }

    // Sức chứa MỖI race = min(Tournament.MaxHorses, Venue.LaneCount).
    public int CapacityPerRace { get; set; }

    public int RaceCount { get; set; }

    // Tổng sức chứa vòng = CapacityPerRace * RaceCount.
    public int TotalCapacity { get; set; }

    public int AllocatedCount { get; set; }

    // Phần dư khi pool > tổng sức chứa. Round 1 dùng danh sách chờ này để Admin
    // xử lý thủ công (schema chưa có chỗ lưu waiting-list cho pairing chưa vào race).
    public int WaitlistedCount { get; set; }

    public List<AutoAllocateRaceDto> Races { get; set; } = new();

    public List<AutoAllocateWaitlistDto> Waitlist { get; set; } = new();
}

public class AutoAllocateRaceDto
{
    public int RaceId { get; set; }

    public int RaceNumber { get; set; }

    public DateTime ScheduledTime { get; set; }

    public int EntryCount { get; set; }

    public List<AutoAllocateEntryDto> Entries { get; set; } = new();
}

public class AutoAllocateEntryDto
{
    public int RaceEntryId { get; set; }

    public int PairingId { get; set; }

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public int JockeyId { get; set; }

    public string JockeyName { get; set; } = string.Empty;
}

// Pairing đủ điều kiện nhưng vượt sức chứa của vòng.
public class AutoAllocateWaitlistDto
{
    public int PairingId { get; set; }

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    // Thời điểm lệ phí được xác nhận — cơ sở xếp thứ tự ưu tiên.
    public DateTime? FeeVerifiedAt { get; set; }
}
