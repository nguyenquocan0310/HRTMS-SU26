using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class OwnerProfile
{
    public int OwnerId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Horse> Horses { get; set; } = new List<Horse>();

    public virtual User Owner { get; set; } = null!;
}
