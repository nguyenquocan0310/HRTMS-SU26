namespace HRTMS.Core.DTOs.Assignment;

public class MyRaceAssignmentDto
{
    public int RaceId { get; set; }

    public int RaceNumber { get; set; }

    public DateTime ScheduledTime { get; set; }

    public string RaceStatus { get; set; } = null!;

    public int RoundId { get; set; }

    public string RoundName { get; set; } = null!;

    public int TournamentId { get; set; }

    public string TournamentName { get; set; } = null!;

    public string? AssignmentRole { get; set; }

    public DateTime AssignedAt { get; set; }
}