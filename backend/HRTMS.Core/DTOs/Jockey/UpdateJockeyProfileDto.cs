using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Jockey;

public class UpdateJockeyProfileDto
{
    [Range(0.01, 300, ErrorMessage = "Self-declared weight must be greater than 0.")]
    public decimal? SelfDeclaredWeight { get; set; }

    [MaxLength(5, ErrorMessage = "Blood type must not exceed 5 characters.")]
    public string? BloodType { get; set; }

    [RegularExpression(
        "^(Good|Fair|Under Treatment)$",
        ErrorMessage = "Health status must be Good, Fair, or Under Treatment.")]
    public string? HealthStatus { get; set; }

    [MaxLength(100, ErrorMessage = "License certificate must not exceed 100 characters.")]
    public string? LicenseCertificate { get; set; }
}