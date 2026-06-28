using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class RefereeProfile
{
    public int RefereeId { get; set; }

    public string CertificationLevel { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? RejectionReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<RaceEntry> RaceEntries { get; set; } = new List<RaceEntry>();

    public virtual ICollection<RaceReport> RaceReports { get; set; } = new List<RaceReport>();

    public virtual User Referee { get; set; } = null!;

    public virtual ICollection<RefereeAssignment> RefereeAssignments { get; set; } = new List<RefereeAssignment>();
}
