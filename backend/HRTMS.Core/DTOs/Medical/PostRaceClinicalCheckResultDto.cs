namespace HRTMS.Core.DTOs.Medical;

public class PostRaceClinicalCheckResultDto
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public int DoctorId { get; set; }

    public string DoctorName { get; set; } = null!;

    public string HorseName { get; set; } = null!;

    public string JockeyName { get; set; } = null!;

    public string PostRaceClinicalStatus { get; set; } = null!;

    public string? UnfitReason { get; set; }

    public bool IsEmergencyDisqualified { get; set; }

    public string RaceEntryStatus { get; set; } = null!;

    public string Message { get; set; } = null!;
}
