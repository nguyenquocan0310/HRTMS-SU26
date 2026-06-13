using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class PrizeDistribution
{
    public int PrizeDistributionId { get; set; }

    public int TournamentId { get; set; }

    public int Position { get; set; }

    public decimal Percentage { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Tournament Tournament { get; set; } = null!;
}
