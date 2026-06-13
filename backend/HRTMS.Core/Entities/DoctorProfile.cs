using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class DoctorProfile
{
    public int DoctorId { get; set; }

    public string MedicalLicenseNumber { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? RejectionReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual User Doctor { get; set; } = null!;

    public virtual ICollection<DoctorAssignment> DoctorAssignments { get; set; } = new List<DoctorAssignment>();

    public virtual ICollection<RaceEntry> RaceEntryPostRaceWeightByDoctors { get; set; } = new List<RaceEntry>();

    public virtual ICollection<RaceEntry> RaceEntryPreRaceWeightByDoctors { get; set; } = new List<RaceEntry>();
}
