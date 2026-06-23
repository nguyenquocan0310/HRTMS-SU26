using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class User
{
    public int UserId { get; set; }

    public string Username { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string Role { get; set; } = null!;

    public string Status { get; set; } = null!;

    public int FailedLoginAttempts { get; set; }

    public DateTime? LockoutEnd { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public virtual DoctorProfile? DoctorProfile { get; set; }

    public virtual ICollection<FamilyRelationshipDeclaration> FamilyRelationshipDeclarationDeclarantUsers { get; set; } = new List<FamilyRelationshipDeclaration>();

    public virtual ICollection<FamilyRelationshipDeclaration> FamilyRelationshipDeclarationRelatedUsers { get; set; } = new List<FamilyRelationshipDeclaration>();

    public virtual JockeyProfile? JockeyProfile { get; set; }

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual OwnerProfile? OwnerProfile { get; set; }

    public virtual ICollection<Protest> Protests { get; set; } = new List<Protest>();

    public virtual ICollection<PursePayout> PursePayoutRecipientUsers { get; set; } = new List<PursePayout>();

    public virtual ICollection<PursePayout> PursePayoutUpdatedByAdmins { get; set; } = new List<PursePayout>();

    public virtual ICollection<RaceEntry> RaceEntries { get; set; } = new List<RaceEntry>();

    public virtual RefereeProfile? RefereeProfile { get; set; }

    public virtual SpectatorProfile? SpectatorProfile { get; set; }

    public virtual ICollection<Tournament> Tournaments { get; set; } = new List<Tournament>();

    public virtual ICollection<TournamentParticipant> TournamentParticipants { get; set; } = new List<TournamentParticipant>();
}
