using System;

namespace HRTMS.Core.Entities;

// Nộp & đối chiếu lệ phí tham gia (patch 012).
// Một Pairing chỉ có MỘT payment đang hiệu lực (PendingVerification/Verified) —
// bảo đảm bởi filtered unique index UQ_EFP_ActivePerPairing.
// Pairing chỉ chuyển Confirmed khi payment được Admin verify.
public partial class EntryFeePayment
{
    public int PaymentId { get; set; }

    public int PairingId { get; set; }

    public decimal Amount { get; set; }

    // 'Cash' | 'Transfer'
    public string Method { get; set; } = null!;

    // Bắt buộc khi Method = 'Cash'.
    public string? ReceiptNo { get; set; }

    // Bắt buộc khi Method = 'Transfer'.
    public string? TransferRef { get; set; }

    // Tên file gốc do người dùng upload (chỉ để hiển thị/tải về).
    public string? ProofFileName { get; set; }

    // Path TƯƠNG ĐỐI trong kho file private, không phải path tuyệt đối.
    public string? ProofFilePath { get; set; }

    // 'PendingVerification' | 'Verified' | 'Rejected' | 'RefundPending' | 'Refunded'
    public string Status { get; set; } = null!;

    public DateTime SubmittedAt { get; set; }

    public int? VerifiedBy { get; set; }

    public DateTime? VerifiedAt { get; set; }

    public string? RejectReason { get; set; }

    public virtual Pairing Pairing { get; set; } = null!;

    public virtual User? VerifiedByNavigation { get; set; }
}
