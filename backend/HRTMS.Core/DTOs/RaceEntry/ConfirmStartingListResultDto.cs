namespace HRTMS.Core.DTOs.RaceEntry;

public class ConfirmStartingListResultDto
{
    public int RaceId { get; set; }

    public int ConfirmedEntriesCount { get; set; }

    public int RejectedEntriesCount { get; set; }

    public List<StartingListEntryDto> ConfirmedEntries { get; set; } = new();

    public List<StartingListEntryDto> RejectedEntries { get; set; } = new();

    public string Message { get; set; } = null!;
}