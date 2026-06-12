using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class Protest
{
    public int ProtestId { get; set; }

    public int RaceId { get; set; }

    public int SubmittedByUserId { get; set; }

    public int AccusedRaceEntryId { get; set; }

    public int? ViolationId { get; set; }

    public string Description { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? RefereeDecision { get; set; }

    public string? PenaltyApplied { get; set; }

    public DateTime SubmittedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    public virtual RaceEntry AccusedRaceEntry { get; set; } = null!;

    public virtual Race Race { get; set; } = null!;

    public virtual User SubmittedByUser { get; set; } = null!;

    public virtual Violation? Violation { get; set; }
}
