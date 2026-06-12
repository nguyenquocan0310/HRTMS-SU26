using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class Tournament
{
    public int TournamentId { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public int MaxHorses { get; set; }

    public string AllowedBreed { get; set; } = null!;

    public string TrackType { get; set; } = null!;

    public int RaceDistance { get; set; }

    public string RaceCategory { get; set; } = null!;

    public int MinJockeyExperienceYears { get; set; }

    public decimal PurseAmount { get; set; }

    public decimal EntryFeeAmount { get; set; }

    public decimal PreRaceWeightThresholdKg { get; set; }

    public decimal PostRaceWeightDiffThresholdKg { get; set; }

    public string Status { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int? CreatedBy { get; set; }

    public virtual User? CreatedByNavigation { get; set; }

    public virtual ICollection<PrizeDistribution> PrizeDistributions { get; set; } = new List<PrizeDistribution>();

    public virtual ICollection<Round> Rounds { get; set; } = new List<Round>();
}
