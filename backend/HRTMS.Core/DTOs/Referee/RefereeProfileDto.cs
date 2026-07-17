namespace HRTMS.Core.DTOs.Referee;

public class RefereeProfileDto
{
    public int RefereeId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string CertificationLevel { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public DateTime CreatedAt { get; set; }
}