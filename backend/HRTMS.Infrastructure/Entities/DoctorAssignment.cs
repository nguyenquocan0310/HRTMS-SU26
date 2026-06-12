using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class DoctorAssignment
{
    public int RaceId { get; set; }

    public int DoctorId { get; set; }

    public DateTime AssignedAt { get; set; }

    public DateTime? CertifiedAt { get; set; }

    public virtual DoctorProfile Doctor { get; set; } = null!;

    public virtual Race Race { get; set; } = null!;
}
