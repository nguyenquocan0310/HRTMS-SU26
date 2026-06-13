using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class Horse
{
    public int HorseId { get; set; }

    public int OwnerId { get; set; }

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

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual OwnerProfile Owner { get; set; } = null!;

    public virtual ICollection<Pairing> Pairings { get; set; } = new List<Pairing>();
}
