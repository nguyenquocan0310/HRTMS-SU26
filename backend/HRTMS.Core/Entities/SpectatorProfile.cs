using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class SpectatorProfile
{
    public int SpectatorId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<Prediction> Predictions { get; set; } = new List<Prediction>();

    public virtual User Spectator { get; set; } = null!;

    public virtual Wallet? Wallet { get; set; }
}
