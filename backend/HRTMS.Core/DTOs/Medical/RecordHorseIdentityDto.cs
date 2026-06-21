using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Medical;

public class RecordHorseIdentityDto
{
    // Ket qua xac minh danh tinh ngua
    // Chi chap nhan Matched hoac Mismatch
    [Required(ErrorMessage = "HorseIdentityStatus is required.")]
    [RegularExpression(
        "^(Matched|Mismatch)$",
        ErrorMessage = "HorseIdentityStatus must be Matched or Mismatch.")]
    public string HorseIdentityStatus { get; set; } = null!;
}