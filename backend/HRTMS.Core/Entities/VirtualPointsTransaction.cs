using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class VirtualPointsTransaction
{
    public int TransactionId { get; set; }

    public int WalletId { get; set; }

    public int Amount { get; set; }

    public string Type { get; set; } = null!;

    public string? ReferenceType { get; set; }

    public string? ReferenceId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Wallet Wallet { get; set; } = null!;
}
