using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

/// <summary>
/// Schema v2: OwnerProfile chỉ còn OwnerId (FK = PK).
/// PhoneNumber + IdentityNumber đã chuyển sang Users.PhoneNumber / Users.IdentityNumberEncrypted.
/// </summary>
public partial class OwnerProfile
{
    public int OwnerId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Horse> Horses { get; set; } = new List<Horse>();

    public virtual User Owner { get; set; } = null!;
}