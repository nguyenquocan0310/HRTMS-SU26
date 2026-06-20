
using System;

namespace HRTMS.Core.DTOs.FamilyDeclaration;

public class FamilyDeclarationResponseDto
{
    public int DeclarationId { get; set; }
    public int DeclarantUserId { get; set; }
    public string RelatedPersonName { get; set; } = string.Empty;
    public int? RelatedUserId { get; set; }
    public string? RelatedUserFullName { get; set; } // populate nếu RelatedUserId != null
    public string? RelatedUserRole { get; set; }     // populate nếu RelatedUserId != null
    public string RelationType { get; set; } = string.Empty;
    public string? IndustryRole { get; set; }
    public string? Notes { get; set; }
    public DateTime DeclaredAt { get; set; }
}