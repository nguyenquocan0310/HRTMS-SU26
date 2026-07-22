using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Payment
{
    // Owner nộp thông tin lệ phí cho một Pairing (patch 013).
    // Gửi dạng multipart/form-data vì kèm file chứng từ (tùy chọn).
    public class SubmitFeePaymentDto
    {
        // 'Cash' | 'Transfer'
        [Required]
        public string Method { get; set; } = string.Empty;

        // Bắt buộc khi Method = 'Cash' (validate ở service, không ở attribute
        // vì phụ thuộc Method).
        [MaxLength(50)]
        public string? ReceiptNo { get; set; }

        // Bắt buộc khi Method = 'Transfer'.
        [MaxLength(100)]
        public string? TransferRef { get; set; }
    }
}
