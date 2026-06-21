using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Referee;

public class AssignRefereeDto
{
    // Id cua Referee duoc Admin gan vao Race
    [Required(ErrorMessage = "RefereeId is required.")]
    public int RefereeId { get; set; }

    // Vai tro cua Referee trong Race
    // Chi chap nhan Lead Referee hoac Assistant Referee
    [Required(ErrorMessage = "Role is required.")]
    [RegularExpression(
        "^(Lead Referee|Assistant Referee)$",
        ErrorMessage = "Role must be Lead Referee or Assistant Referee.")]
    public string Role { get; set; } = null!;
}