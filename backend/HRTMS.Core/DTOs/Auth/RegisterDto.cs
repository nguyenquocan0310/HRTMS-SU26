using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Auth;

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

    // Owner profile
    public string? PhoneNumber { get; set; }
    public string? IdentityNumber { get; set; }

    // Jockey profile
    public string? LicenseCertificate { get; set; }
    public int? ExperienceYears { get; set; }
    public decimal? SelfDeclaredWeight { get; set; }

    // Race Referee profile
    public string? CertificationLevel { get; set; }

    // Doctor profile
    public string? MedicalLicenseNumber { get; set; }
}
