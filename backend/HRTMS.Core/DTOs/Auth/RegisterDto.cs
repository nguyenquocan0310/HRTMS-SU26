using HRTMS.Core.DTOs.FamilyDeclaration;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Auth;

/// <summary>
/// ACC.1 — Đăng ký tài khoản mới (tự đăng ký, không bao gồm Admin).
/// ACC.1A — Owner/Jockey/Referee/Doctor bắt buộc có PhoneNumber + DateOfBirth + IdentityNumber (CCCD 12 số).
/// ACC.1.2 — Spectator đăng ký tối giản: chỉ cần Username/FullName/Email/Password.
/// </summary>
public class RegisterDto
{
    [Required, MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = string.Empty;

    // ── Định danh bắt buộc cho Owner/Jockey/Referee/Doctor (ACC.1A.1) ──────
    public string? PhoneNumber { get; set; }

    public DateTime? DateOfBirth { get; set; }

    /// <summary>
    /// CCCD 12 số. Bắt buộc với professional roles.
    /// Validate app-layer: regex ^\d{12}$ (DB lưu dạng encrypted VARBINARY).
    /// </summary>
    public string? IdentityNumber { get; set; }

    // ── Jockey profile ──────────────────────────────────────────────────────
    public string? LicenseCertificate { get; set; }
    public int? ExperienceYears { get; set; }
    public decimal? SelfDeclaredWeight { get; set; }
    public string? BloodType { get; set; }
    public string? HealthStatus { get; set; }

    // ── Referee profile ─────────────────────────────────────────────────────
    public string? CertificationLevel { get; set; }

    // ── Doctor profile ──────────────────────────────────────────────────────
    public string? MedicalLicenseNumber { get; set; }

    // ── FamilyRelationshipDeclarations ──────────────────────────────────────
    // Bắt buộc khai khi Role = Jockey hoặc Referee (EC-18)
    // Doctor khai sau tại Dashboard (UI-S30)
    // Owner KHÔNG khai (phía bị match — EC-38)
    public List<FamilyDeclarationItemDto>? FamilyDeclarations { get; set; }
}