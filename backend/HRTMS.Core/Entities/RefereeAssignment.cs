using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class RefereeAssignment
{
    public int RaceId { get; set; }

    public int RefereeId { get; set; }

    public string Role { get; set; } = null!;

    public DateTime AssignedAt { get; set; }

    public virtual Race Race { get; set; } = null!;

    public virtual RefereeProfile Referee { get; set; } = null!;
}
