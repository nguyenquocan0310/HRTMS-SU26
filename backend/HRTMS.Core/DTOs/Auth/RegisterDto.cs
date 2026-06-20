
using HRTMS.Core.DTOs.FamilyDeclaration;
using System.Collections.Generic;
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

    // --- Owner profile ---
    public string? PhoneNumber { get; set; }
    public string? IdentityNumber { get; set; }

    // --- Jockey profile ---
    public string? LicenseCertificate { get; set; }
    public int? ExperienceYears { get; set; }
    public decimal? SelfDeclaredWeight { get; set; }
    public string? BloodType { get; set; }     
    public string? HealthStatus { get; set; }  

    // --- Referee profile ---
    public string? CertificationLevel { get; set; }

    // --- Doctor profile ---
    public string? MedicalLicenseNumber { get; set; }

    // --- FamilyRelationshipDeclarations ---
    // Bắt buộc khai báo khi Role = Jockey hoặc Referee (EC-18)
    // Doctor KHÔNG khai báo lúc Register — khai báo sau tại Dashboard (UI-S30)
    // Owner KHÔNG khai báo (Owner là phía bị match — EC-38)
    public List<FamilyDeclarationItemDto>? FamilyDeclarations { get; set; }
}