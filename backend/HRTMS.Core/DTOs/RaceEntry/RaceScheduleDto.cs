namespace HRTMS.Core.DTOs.RaceEntry;

// Lịch thi đấu công khai của một Race (hiển thị cho mọi Actor).
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
    // DEPRECATED: Owner khong con tu confirm entry (xac nhan den tu verify le phi).
    public DateTime ConfirmationCutoffTime { get; set; }

    // San dua (patch 012) — ke thua tu giai. NULL voi giai cu chua gan san.
    public string? VenueName { get; set; }

    public string? VenueCity { get; set; }

    public string? VenueTrackType { get; set; }

    public int? LaneCount { get; set; }

    public int? TrackLengthMeters { get; set; }

    // Suc chua cuoc dua = min(Tournament.MaxHorses, Venue.LaneCount).
    public int? RaceCapacity { get; set; }

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
