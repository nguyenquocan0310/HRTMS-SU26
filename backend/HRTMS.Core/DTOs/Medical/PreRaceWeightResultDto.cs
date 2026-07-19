namespace HRTMS.Core.DTOs.Medical;

public class PreRaceWeightResultDto
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public int DoctorId { get; set; }

    public string DoctorName { get; set; } = null!;

    public string HorseName { get; set; } = null!;

    public string JockeyName { get; set; } = null!;

    public decimal SelfDeclaredWeight { get; set; }

    public decimal PreRaceJockeyWeight { get; set; }

    public decimal WeightDifference { get; set; }

    public decimal ThresholdKg { get; set; }

    public bool IsWeightWarning { get; set; }

    public bool IsEmergencyDisqualified { get; set; }

    public string RaceEntryStatus { get; set; } = null!;

    public string Message { get; set; } = null!;
}