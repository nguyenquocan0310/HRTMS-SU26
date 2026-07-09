namespace HRTMS.Core.DTOs.RaceEntry;

// Kết quả bốc thăm vị trí xuất phát (Post Position Draw).
public class PostPositionDrawResultDto
{
    public int RaceId { get; set; }

    public bool IsPostPositionDrawn { get; set; }

    public int TotalEntries { get; set; }

    public List<PostPositionAssignmentDto> Assignments { get; set; } = new();
}

public class PostPositionAssignmentDto
{
    public int RaceEntryId { get; set; }

    public int PairingId { get; set; }

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public int PostPosition { get; set; }
}
