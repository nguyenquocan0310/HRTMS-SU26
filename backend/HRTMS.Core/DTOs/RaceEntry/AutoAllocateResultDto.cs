namespace HRTMS.Core.DTOs.RaceEntry;

// Kết quả auto-allocate một vòng đấu (patch 013/Module E).
public class AutoAllocateResultDto
{
    public int RoundId { get; set; }

    public int TournamentId { get; set; }

    // true = kết quả của /preview (dry-run, KHÔNG ghi DB).
    public bool IsPreview { get; set; }

    // CHỈ có ý nghĩa ở preview: false nghĩa là "ngựa nào vào race nào" CHƯA chốt.
    // Preview cho biết AI được vào và AI phải chờ (tất định theo thứ tự ưu tiên),
    // nhưng việc chia vào race cụ thể dùng Fisher-Yates ở thời điểm chốt nên
    // Races[].Entries để rỗng, chỉ có EntryCount là tất định.
    public bool AssignmentIsFinal { get; set; } = true;

    // Danh sách được chọn, theo thứ tự ưu tiên. Chỉ điền ở preview
    // (ở kết quả thật thì đã nằm trong Races[].Entries).
    public List<AutoAllocateSelectedDto> SelectedPool { get; set; } = new();

    // Cảnh báo cho FE hiển thị trước khi Admin bấm chốt (vd vượt sức chứa).
    public List<string> Warnings { get; set; } = new();

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

// Pairing được chọn vào vòng, kèm thứ tự ưu tiên đã dùng để cắt pool.
public class AutoAllocateSelectedDto
{
    public int Position { get; set; }

    public int PairingId { get; set; }

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public int JockeyId { get; set; }

    public string JockeyName { get; set; } = string.Empty;

    public DateTime? FeeVerifiedAt { get; set; }
}

// Pairing đủ điều kiện nhưng vượt sức chứa của vòng.
// Được PERSIST vào bảng RoundWaitlist khi chốt (patch 014).
public class AutoAllocateWaitlistDto
{
    // Thứ tự gọi bù, 1 = gọi trước. Khớp RoundWaitlist.Position.
    public int Position { get; set; }

    public int PairingId { get; set; }

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    // Thời điểm lệ phí được xác nhận — cơ sở xếp thứ tự ưu tiên.
    public DateTime? FeeVerifiedAt { get; set; }
}
