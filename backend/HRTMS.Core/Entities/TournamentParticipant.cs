using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class TournamentParticipant
{
    public int ParticipantId { get; set; }

    public int TournamentId { get; set; }

    public int UserId { get; set; }

    public string Role { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string ScreeningStatus { get; set; } = null!;

    public string? ScreeningReason { get; set; }

    public string? RejectionReason { get; set; }

    public DateTime RegisteredAt { get; set; }

    public int? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public virtual User? ApprovedByNavigation { get; set; }

    public virtual ICollection<Pairing> Pairings { get; set; } = new List<Pairing>();

    public virtual Tournament Tournament { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
