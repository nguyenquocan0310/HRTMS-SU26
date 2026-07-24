namespace HRTMS.Core.DTOs.Payment;

// Bản theo dõi pairing dành cho Admin. Payment là nullable để danh sách vẫn
// hiển thị cả cặp chưa từng nộp lệ phí/chưa có chứng từ.
public class AdminFeePairingDto
{
    public int PairingId { get; set; }
    public int TournamentId { get; set; }
    public string TournamentName { get; set; } = string.Empty;
    public int HorseId { get; set; }
    public string HorseName { get; set; } = string.Empty;
    public int JockeyId { get; set; }
    public string JockeyName { get; set; } = string.Empty;
    public int OwnerId { get; set; }
    public string OwnerName { get; set; } = string.Empty;
    public string PairingStatus { get; set; } = string.Empty;
    public string? PairingResponseReason { get; set; }
    public DateTime PairingCreatedAt { get; set; }

    public int? PaymentId { get; set; }
    public decimal? Amount { get; set; }
    public string? Method { get; set; }
    public string? ReceiptNo { get; set; }
    public string? TransferRef { get; set; }
    public string? ProofFileName { get; set; }
    public bool HasProof { get; set; }
    public string? PaymentStatus { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? RejectReason { get; set; }

    // Chỉ cặp có thể nộp phí nhưng chưa có payment nào mới được Admin từ chối.
    public bool CanRejectUnpaid { get; set; }
}

public class RejectUnpaidPairingDto
{
    public string Reason { get; set; } = string.Empty;
}
