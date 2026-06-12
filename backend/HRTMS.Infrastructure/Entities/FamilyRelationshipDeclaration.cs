using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class FamilyRelationshipDeclaration
{
    public int DeclarationId { get; set; }

    public int DeclarantUserId { get; set; }

    public string RelatedPersonName { get; set; } = null!;

    public int? RelatedUserId { get; set; }

    public string RelationType { get; set; } = null!;

    public string? IndustryRole { get; set; }

    public string? Notes { get; set; }

    public DateTime DeclaredAt { get; set; }

    public virtual User DeclarantUser { get; set; } = null!;

    public virtual User? RelatedUser { get; set; }
}
