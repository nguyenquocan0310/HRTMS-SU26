namespace HRTMS.Core.DTOs.Referee;

public class IndependenceCheckListDto
{
    public int RaceEntryId { get; set; }

    public int PairingId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public string JockeyName { get; set; } = string.Empty;

    public string IndependenceCheckStatus { get; set; } = string.Empty;

    public string? IndependenceViolationReason { get; set; }

    public string RaceEntryStatus { get; set; } = string.Empty;
}