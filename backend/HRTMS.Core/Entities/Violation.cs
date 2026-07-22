using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class Violation
{
    public int ViolationId { get; set; }

    public int RaceReportId { get; set; }

    public int RaceEntryId { get; set; }

    public string ViolationCode { get; set; } = null!;

    public string Penalty { get; set; } = null!;

    public int? PlaceBehindEntryId { get; set; }

    public string Description { get; set; } = null!;

    public DateTime LoggedAt { get; set; }

    public virtual RaceEntry? PlaceBehindEntry { get; set; }

    public virtual RaceEntry RaceEntry { get; set; } = null!;

    public virtual RaceReport RaceReport { get; set; } = null!;
}
