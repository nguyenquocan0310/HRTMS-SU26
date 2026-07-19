namespace HRTMS.Core.DTOs.Jockey;

public class JockeyProfileDto
{
    public int JockeyId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string LicenseCertificate { get; set; } = string.Empty;

    public int ExperienceYears { get; set; }

    public decimal SelfDeclaredWeight { get; set; }

    public string? BloodType { get; set; }

    public string? HealthStatus { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? PhoneNumber { get; set; }

    public DateTime? DateOfBirth { get; set; }

    public DateTime CreatedAt { get; set; }
}