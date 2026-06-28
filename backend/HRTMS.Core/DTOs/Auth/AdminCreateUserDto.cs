using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Auth;

/// <summary>
/// ACC.2 — Admin tạo tài khoản cho bất kỳ role nào, kể cả Admin.
/// Validate giống self-register + cho phép role Admin.
/// </summary>
public class AdminCreateUserDto
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

    // ── Định danh (bắt buộc nếu role là professional) ───────────────────────
    public string? PhoneNumber { get; set; }
    public DateTime? DateOfBirth { get; set; }

    /// <summary>CCCD 12 số — bắt buộc với Owner/Jockey/Referee/Doctor.</summary>
    public string? IdentityNumber { get; set; }

    // ── Profile fields per role ──────────────────────────────────────────────
    public string? LicenseCertificate { get; set; }
    public int? ExperienceYears { get; set; }
    public decimal? SelfDeclaredWeight { get; set; }
    public string? BloodType { get; set; }
    public string? HealthStatus { get; set; }
    public string? CertificationLevel { get; set; }
    public string? MedicalLicenseNumber { get; set; }
}