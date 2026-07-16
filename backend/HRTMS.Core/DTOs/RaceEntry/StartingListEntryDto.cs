namespace HRTMS.Core.DTOs.RaceEntry;

public class StartingListEntryDto
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public int PairingId { get; set; }

    public string HorseName { get; set; } = null!;

    public string JockeyName { get; set; } = null!;

    public string OwnerName { get; set; } = null!;

    public int? PostPosition { get; set; }

    public string Status { get; set; } = null!;

    public decimal? PreRaceJockeyWeight { get; set; }

    public string? HorseIdentityCheckStatus { get; set; }

    public string? ClinicalStatus { get; set; }

    public string? RejectionReason { get; set; }
}