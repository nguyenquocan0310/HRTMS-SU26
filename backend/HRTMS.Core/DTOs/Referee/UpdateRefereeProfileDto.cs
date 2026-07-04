using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Referee;

public class UpdateRefereeProfileDto
{
    [Required, MaxLength(50)]
    public string CertificationLevel { get; set; } = string.Empty;
}