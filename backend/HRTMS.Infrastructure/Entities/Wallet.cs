using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class Wallet
{
    public int WalletId { get; set; }

    public int SpectatorId { get; set; }

    public int Balance { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual SpectatorProfile Spectator { get; set; } = null!;

    public virtual ICollection<VirtualPointsTransaction> VirtualPointsTransactions { get; set; } = new List<VirtualPointsTransaction>();
}
