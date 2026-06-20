namespace HRTMS.Core.DTOs.RaceEntry;

// SCH.3 — Lich thi dau cong khai cua mot Race (hien thi cho moi Actor).
public class RaceScheduleDto
{
    public int RaceId { get; set; }

    public int RoundId { get; set; }

    public int RaceNumber { get; set; }

    public DateTime ScheduledTime { get; set; }

    public string Status { get; set; } = string.Empty;

    public bool IsPostPositionDrawn { get; set; }

    public int ConfirmationCutoffHours { get; set; }

    // Thoi diem chot xac nhan = ScheduledTime - ConfirmationCutoffHours.
    public DateTime ConfirmationCutoffTime { get; set; }

    public List<RaceScheduleEntryDto> Entries { get; set; } = new();
}

public class RaceScheduleEntryDto
{
    public int RaceEntryId { get; set; }

    public int? PostPosition { get; set; }

    public string Status { get; set; } = string.Empty;

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public int JockeyId { get; set; }

    public string JockeyName { get; set; } = string.Empty;
}
