using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Medical;

// Doctor kham lam sang lai cho CA ngua va nai sau khi ket thuc tran
// (sau khi Referee da submit finish results, Race o trang thai Unofficial).
public class RecordPostRaceClinicalCheckDto
{
    [Required(ErrorMessage = "PostRaceClinicalStatus is required.")]
    [RegularExpression(
        "^(Fit|Unfit)$",
        ErrorMessage = "PostRaceClinicalStatus must be Fit or Unfit.")]
    public string PostRaceClinicalStatus { get; set; } = null!;

    // Bat buoc neu PostRaceClinicalStatus la Unfit
    public string? UnfitReason { get; set; }
}
