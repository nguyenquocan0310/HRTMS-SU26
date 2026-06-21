using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Medical;

public class RecordClinicalCheckDto
{
    // Ket qua kiem tra suc khoe ngua
    // Chi chap nhan Fit hoac Unfit
    [Required(ErrorMessage = "ClinicalStatus is required.")]
    [RegularExpression(
        "^(Fit|Unfit)$",
        ErrorMessage = "ClinicalStatus must be Fit or Unfit.")]
    public string ClinicalStatus { get; set; } = null!;

    // Bat buoc neu ClinicalStatus la Unfit
    public string? UnfitReason { get; set; }
}