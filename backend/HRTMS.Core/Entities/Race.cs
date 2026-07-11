using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class Race
{
    public int RaceId { get; set; }

    public int RoundId { get; set; }

    public int RaceNumber { get; set; }

    public DateTime ScheduledTime { get; set; }

    public decimal PurseAmount { get; set; }

    public string? TrackTypeOverride { get; set; }

    public int? RaceDistanceOverride { get; set; }

    public string Status { get; set; } = null!;

    // Module H mở rộng (UI-S07 Live Race Simulation): thời điểm Referee thực sự
    // bấm "Start Race" (Live), khác ScheduledTime (giờ dự kiến). NULL nếu chưa Live.
    public DateTime? ActualStartTime { get; set; }

    public bool IsPostPositionDrawn { get; set; }

    public bool IsPredictionGateClosed { get; set; }

    public int ConfirmationCutoffHours { get; set; }

    public int ProtestDeadlineMinutes { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<DoctorAssignment> DoctorAssignments { get; set; } = new List<DoctorAssignment>();

    public virtual ICollection<Prediction> Predictions { get; set; } = new List<Prediction>();

    public virtual ICollection<Protest> Protests { get; set; } = new List<Protest>();

    public virtual ICollection<RaceEntry> RaceEntries { get; set; } = new List<RaceEntry>();

    public virtual RaceReport? RaceReport { get; set; }

    public virtual RefereeAssignment? RefereeAssignment { get; set; }

    public virtual Round Round { get; set; } = null!;
}
