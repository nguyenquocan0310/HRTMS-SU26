using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class TicketRewardCode
{
    public int TicketRewardCodeId { get; set; }

    public string Code { get; set; } = null!;

    public int PointAmount { get; set; }

    public string Status { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public int? RedeemedBySpectatorId { get; set; }

    public DateTime? RedeemedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual SpectatorProfile? RedeemedBySpectator { get; set; }
}
