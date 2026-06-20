using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.FamilyDeclaration;

/// <summary>
/// Dùng cho cả 2 trường hợp:
/// 1. Nhúng trong RegisterDto (Jockey/Referee đăng ký)
/// 2. Request body cho POST/PUT /api/family-declarations (sau đăng ký)
/// </summary>
public class FamilyDeclarationItemDto
{
    [Required, MaxLength(100)]
    public string RelatedPersonName { get; set; } = string.Empty; // luôn bắt buộc

    // Có khi người dùng chọn từ autocomplete → exact match
    // NULL khi tự nhập tên không chọn gợi ý → fallback theo tên
    public int? RelatedUserId { get; set; }

    [Required]
    public string RelationType { get; set; } = string.Empty; // Spouse/Parent/Child/Sibling

    public string? IndustryRole { get; set; } // Owner/Jockey/Referee/Doctor (tùy chọn)
    public string? Notes { get; set; }
}