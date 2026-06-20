namespace HRTMS.Core.DTOs.Jockey;

public class AvailableJockeyDto
{
    public int JockeyId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string LicenseCertificate { get; set; } = string.Empty;

    public int ExperienceYears { get; set; }

    public string? HealthStatus { get; set; }
}