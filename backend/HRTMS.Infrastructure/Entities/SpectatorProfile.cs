using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class SpectatorProfile
{
    public int SpectatorId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<Prediction> Predictions { get; set; } = new List<Prediction>();

    public virtual User Spectator { get; set; } = null!;

    public virtual Wallet? Wallet { get; set; }
}
