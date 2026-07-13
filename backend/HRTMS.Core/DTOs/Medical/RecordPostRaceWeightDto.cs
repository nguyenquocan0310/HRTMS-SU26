using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Medical;

public class RecordPostRaceWeightDto
{
    [Required(ErrorMessage = "PostRaceJockeyWeight is required.")]
    [Range(1, 300, ErrorMessage = "PostRaceJockeyWeight must be greater than 0.")]
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
    public string Message { get; set; } = string.Empty;
}
