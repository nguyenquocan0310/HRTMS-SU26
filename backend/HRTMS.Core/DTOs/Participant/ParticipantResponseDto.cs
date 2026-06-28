namespace HRTMS.Core.DTOs.Participant;

/// <summary>Một dòng trong roster thành viên của giải.</summary>
public class ParticipantResponseDto
{
    public int ParticipantId { get; set; }
    public int TournamentId { get; set; }
    public string? TournamentName { get; set; }
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string ScreeningStatus { get; set; } = "NotScreened";
    public string? ScreeningReason { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime RegisteredAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
}
