using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class Prediction
{
    public int PredictionId { get; set; }

    public int SpectatorId { get; set; }

    public int RaceId { get; set; }

    public int RaceEntryId { get; set; }

    public string PredictionType { get; set; } = null!;

    public int PointsPlaced { get; set; }

    public string Status { get; set; } = null!;

    public int? PointsAwarded { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Race Race { get; set; } = null!;

    public virtual RaceEntry RaceEntry { get; set; } = null!;

    public virtual SpectatorProfile Spectator { get; set; } = null!;
}
