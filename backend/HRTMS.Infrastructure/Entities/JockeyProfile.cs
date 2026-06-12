using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class JockeyProfile
{
    public int JockeyId { get; set; }

    public string LicenseCertificate { get; set; } = null!;

    public int ExperienceYears { get; set; }

    public decimal SelfDeclaredWeight { get; set; }

    public string? BloodType { get; set; }

    public string? HealthStatus { get; set; }

    public string Status { get; set; } = null!;

    public string? RejectionReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual User Jockey { get; set; } = null!;

    public virtual ICollection<Pairing> Pairings { get; set; } = new List<Pairing>();
}
