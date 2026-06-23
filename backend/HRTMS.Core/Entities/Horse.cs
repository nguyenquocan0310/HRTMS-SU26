using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class Horse
{
    public int HorseId { get; set; }

    public int OwnerId { get; set; }

    /// <summary>Giải đấu mà ngựa được đăng ký vào (Phase 1: 1 ngựa = 1 giải).
    /// Quyết định AllowedBreed dùng cho auto-reject (REQ-F-HRS.4).</summary>
    public int TournamentId { get; set; }

    public string Name { get; set; } = null!;

    public int BirthYear { get; set; }

    public string Gender { get; set; } = null!;

    public string Color { get; set; } = null!;

    public string? Pedigree { get; set; }

    public decimal Weight { get; set; }

    public string IdentifyingMarks { get; set; } = null!;

    public string Breed { get; set; } = null!;

    public string VaccinationRecordRef { get; set; } = null!;

    public DateOnly DopingTestDate { get; set; }

    public string DopingTestResult { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string AdminApprovalStatus { get; set; } = null!;

    public string? RejectionReason { get; set; }

    public bool LegalConsentAccepted { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual OwnerProfile Owner { get; set; } = null!;

    public virtual Tournament Tournament { get; set; } = null!;

    public virtual ICollection<Pairing> Pairings { get; set; } = new List<Pairing>();
}
