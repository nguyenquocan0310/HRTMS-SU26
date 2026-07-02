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

    /// <summary>
    /// CCCD (12 số) của người thân được khai báo — BẮT BUỘC.
    /// Đây là cơ chế match DUY NHẤT để resolve RelatedUserId + MatchConfidence.
    /// Không lưu plaintext: chỉ dùng để tính hash (SHA256) so khớp với User.IdentityHash,
    /// không phải lưu trực tiếp vào entity.
    /// </summary>
    [Required(ErrorMessage = "CCCD của người thân là bắt buộc để đối chiếu xung đột lợi ích.")]
    [RegularExpression(@"^\d{12}$", ErrorMessage = "CCCD phải gồm đúng 12 chữ số.")]
    public string RelatedIdentityNumber { get; set; } = string.Empty;

    public string? Notes { get; set; }
}