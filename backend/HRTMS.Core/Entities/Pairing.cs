using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class Pairing
{
    public int PairingId { get; set; }

    public int HorseId { get; set; }

    public int JockeyId { get; set; }

    public string Status { get; set; } = null!;

    public string? RequestMessage { get; set; }

    public string? ResponseReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Horse Horse { get; set; } = null!;

    public virtual JockeyProfile Jockey { get; set; } = null!;

    public virtual ICollection<RaceEntry> RaceEntries { get; set; } = new List<RaceEntry>();
}
