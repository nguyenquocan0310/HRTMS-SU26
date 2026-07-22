using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Payment
{
    // Admin từ chối một payment. Lý do BẮT BUỘC — Owner cần biết phải sửa gì
    // để nộp lại trước hạn.
    public class RejectFeePaymentDto
    {
        [Required(ErrorMessage = "Phải nêu lý do từ chối.")]
        [MinLength(10, ErrorMessage = "Lý do từ chối phải có ít nhất 10 ký tự.")]
        [MaxLength(500)]
        public string Reason { get; set; } = string.Empty;
    }
}
