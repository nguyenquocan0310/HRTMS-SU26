using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class OwnerProfile
{
    public int OwnerId { get; set; }

    public string PhoneNumber { get; set; } = null!;

    public string IdentityNumber { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Horse> Horses { get; set; } = new List<Horse>();

    public virtual User Owner { get; set; } = null!;
}
