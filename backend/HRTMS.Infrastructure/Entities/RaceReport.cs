using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class RaceReport
{
    public int RaceReportId { get; set; }

    public int RaceId { get; set; }

    public int LeadRefereeId { get; set; }

    public string? Notes { get; set; }

    public bool IsLocked { get; set; }

    public DateTime SubmittedAt { get; set; }

    public DateTime? LockedAt { get; set; }

    public virtual RefereeProfile LeadReferee { get; set; } = null!;

    public virtual Race Race { get; set; } = null!;

    public virtual ICollection<Violation> Violations { get; set; } = new List<Violation>();
}
