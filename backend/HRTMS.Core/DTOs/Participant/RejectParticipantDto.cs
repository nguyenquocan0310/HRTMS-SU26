using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Participant;

public class RejectParticipantDto
{
    [Required]
    [MinLength(10, ErrorMessage = "Lý do từ chối phải có ít nhất 10 ký tự.")]
    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}
