namespace HRTMS.Core.DTOs.RaceEntry;

// Kết quả của Withdrawal Flow (idempotent).
public class WithdrawResultDto
{
    public int RaceEntryId { get; set; }

    public string Status { get; set; } = string.Empty;

    // So du doan (Prediction) duoc danh dau Refunded trong lan goi nay.
    public int RefundedPredictions { get; set; }

    // true neu entry da o trang thai Cancelled tu truoc (khong co thay doi moi).
    public bool AlreadyWithdrawn { get; set; }

    // Ket qua hoan le phi (patch 012):
    //   'NotApplicable' — entry chua tra phi / giai mien phi.
    //   'NoRefundPolicy' — giai khong dat RefundDeadline => khong hoan phi.
    //   'Refunding'     — con trong han, payment chuyen RefundPending cho Module N.
    //   'DeadlinePassed'— qua han hoan phi, KHONG hoan; payment giu Verified.
    public string RefundOutcome { get; set; } = "NotApplicable";

    // Han hoan phi cua giai — FE dung de hien thi/dem nguoc. NULL = khong hoan.
    public DateTime? RefundDeadline { get; set; }

    public string Message { get; set; } = string.Empty;
}
