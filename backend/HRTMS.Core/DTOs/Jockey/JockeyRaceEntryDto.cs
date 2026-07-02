namespace HRTMS.Core.DTOs.Jockey;

// Response cho man Jockey Dashboard: danh sach race ma Jockey dang/da tham gia
public class JockeyRaceEntryDto
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public int PairingId { get; set; }

    public int TournamentId { get; set; }

    public string TournamentName { get; set; } = string.Empty;

    public int RoundId { get; set; }

    public string RoundName { get; set; } = string.Empty;

    public int RaceNumber { get; set; }

    public DateTime ScheduledTime { get; set; }

    public string RaceStatus { get; set; } = string.Empty;

    public string EntryStatus { get; set; } = string.Empty;

    public int? PostPosition { get; set; }

    public int HorseId { get; set; }

    public string HorseName { get; set; } = string.Empty;

    public int OwnerId { get; set; }

    public string OwnerName { get; set; } = string.Empty;

    public string PairingStatus { get; set; } = string.Empty;

    public decimal? PreRaceJockeyWeight { get; set; }

    public string? HorseIdentityCheckStatus { get; set; }

    public string? ClinicalStatus { get; set; }

    public string IndependenceCheckStatus { get; set; } = string.Empty;

    public decimal? PostRaceJockeyWeight { get; set; }

    public int? FinishPosition { get; set; }

    public decimal? FinishTime { get; set; }

    public int? PointsAwarded { get; set; }

    public decimal? EarningsAwarded { get; set; }

    public string EntryFeeStatus { get; set; } = string.Empty;

    public bool IsWithdrawn { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}