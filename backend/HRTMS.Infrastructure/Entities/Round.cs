using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class Round
{
    public int RoundId { get; set; }

    public int TournamentId { get; set; }

    public string Name { get; set; } = null!;

    public int SequenceOrder { get; set; }

    public DateTime ScheduledDate { get; set; }

    public string Status { get; set; } = null!;

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Race> Races { get; set; } = new List<Race>();

    public virtual Tournament Tournament { get; set; } = null!;
}
