using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class DoctorAssignment
{
    public int RaceId { get; set; }

    public int DoctorId { get; set; }

    public string CoiCheckStatus { get; set; } = null!;

    public DateTime? CoiCheckedAt { get; set; }

    public string? CoiViolationReason { get; set; }

    public DateTime AssignedAt { get; set; }

    public DateTime? CertifiedAt { get; set; }

    public virtual DoctorProfile Doctor { get; set; } = null!;

    public virtual Race Race { get; set; } = null!;
}
