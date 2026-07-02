namespace HRTMS.Core.DTOs.Referee;

public class IndependenceCheckResultDto
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public int RefereeId { get; set; }

    public string RefereeName { get; set; } = null!;

    public string HorseName { get; set; } = null!;

    public int JockeyId { get; set; }

    public string JockeyName { get; set; } = null!;

    public string IndependenceCheckStatus { get; set; } = null!;

    // MED.6 (revised): khong con auto-DQ. True = phat hien COI, chi la canh bao
    // cho Trong tai xem xet thu cong; RaceEntry van active, Jockey van duoc dua.
    public bool HasWarning { get; set; }

    public string? ViolationReason { get; set; }

    public string RaceEntryStatus { get; set; } = null!;

    public string Message { get; set; } = null!;
}