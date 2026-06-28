using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class FamilyRelationshipDeclaration
{
    public int DeclarationId { get; set; }

    public int DeclarantUserId { get; set; }

    public string RelatedPersonName { get; set; } = null!;

    public int? RelatedUserId { get; set; }

    public string RelationType { get; set; } = null!;

    public string? IndustryRole { get; set; }

    public byte[]? RelatedIdentityHash { get; set; }

    public string? RelatedEmailNormalized { get; set; }

    public string? RelatedPhoneNormalized { get; set; }

    public DateOnly? RelatedDateOfBirth { get; set; }

    public string MatchConfidence { get; set; } = null!;

    public string? Notes { get; set; }

    public DateTime DeclaredAt { get; set; }

    public virtual User DeclarantUser { get; set; } = null!;

    public virtual User? RelatedUser { get; set; }
}
