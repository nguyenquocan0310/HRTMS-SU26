using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class PursePayout
{
    public int PursePayoutId { get; set; }

    public int RaceEntryId { get; set; }

    public int RecipientUserId { get; set; }

    public string Role { get; set; } = null!;

    public decimal CalculatedAmount { get; set; }

    public string PayoutStatus { get; set; } = null!;

    public DateTime? PaidAt { get; set; }

    public int? UpdatedByAdminId { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual RaceEntry RaceEntry { get; set; } = null!;

    public virtual User RecipientUser { get; set; } = null!;

    public virtual User? UpdatedByAdmin { get; set; }
}
