using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Medical;

public class RecordPreRaceWeightDto
{
    // Can nang Jockey truoc khi dua
    [Required(ErrorMessage = "PreRaceJockeyWeight is required.")]
    [Range(1, 300, ErrorMessage = "PreRaceJockeyWeight must be greater than 0.")]
    public decimal PreRaceJockeyWeight { get; set; }
}