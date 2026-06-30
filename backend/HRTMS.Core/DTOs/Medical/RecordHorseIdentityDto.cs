using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Medical;

public class RecordHorseIdentityDto
{
    // Ket qua xac minh danh tinh ngua
    // Chi chap nhan Matched hoac Mismatch
    [Required(ErrorMessage = "HorseIdentityCheckStatus is required.")]
    [RegularExpression(
        "^(Matched|Mismatch)$",
        ErrorMessage = "HorseIdentityCheckStatus must be Matched or Mismatch.")]
    public string HorseIdentityCheckStatus { get; set; } = null!;
}