using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Medical;

public class RecordPostRaceWeightDto
{
    [Required(ErrorMessage = "PostRaceJockeyWeight là bắt buộc.")]
    [Range(1, 300, ErrorMessage = "PostRaceJockeyWeight phải lớn hơn 0.")]
    public decimal PostRaceJockeyWeight { get; set; }
}

public class PostRaceWeightResultDto
{
    public int RaceEntryId { get; set; }
    public int RaceId { get; set; }
    public int DoctorId { get; set; }
    public decimal PreRaceJockeyWeight { get; set; }
    public decimal PostRaceJockeyWeight { get; set; }
    public decimal WeightDifference { get; set; }
    public decimal ThresholdKg { get; set; }
    public bool IsWeightFlagged { get; set; }
    public bool IsEmergencyDisqualified { get; set; }
    public string RaceEntryStatus { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}