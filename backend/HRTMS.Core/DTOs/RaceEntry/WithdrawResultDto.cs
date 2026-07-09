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

    public string Message { get; set; } = string.Empty;
}
