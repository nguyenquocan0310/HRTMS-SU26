namespace HRTMS.Core.DTOs.Referee;

public class RefereeAssignmentDto
{
    
    public int RaceId { get; set; }

   
    public int RefereeId { get; set; }

    
    public string RefereeName { get; set; } = null!;

    
    public string RefereeEmail { get; set; } = null!;

    
    public string CertificationLevel { get; set; } = null!;

    
    public string Role { get; set; } = null!;

   
    public DateTime AssignedAt { get; set; }
}