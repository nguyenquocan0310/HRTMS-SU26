namespace HRTMS.Core.DTOs.RaceEntry;

// Response chung cho mot RaceEntry (sau allocate / confirm).
public class RaceEntryResponseDto
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public int PairingId { get; set; }

    public int? PostPosition { get; set; }

    public string Status { get; set; } = string.Empty;

    public string EntryFeeStatus { get; set; } = string.Empty;

    public bool IsWithdrawn { get; set; }

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public int JockeyId { get; set; }

    public string JockeyName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
