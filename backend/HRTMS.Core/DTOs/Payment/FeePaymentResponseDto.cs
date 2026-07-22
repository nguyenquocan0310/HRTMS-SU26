namespace HRTMS.Core.DTOs.Payment
{
    // Shape trả về cho màn đối chiếu lệ phí của Admin và màn theo dõi của Owner.
    // KHÔNG chứa ProofFilePath — path nội bộ không được lộ ra client; client tải
    // chứng từ qua GET /api/fee-payments/{id}/proof (có kiểm tra quyền).
    public class FeePaymentResponseDto
    {
        public int PaymentId { get; set; }
        public int PairingId { get; set; }
        public int TournamentId { get; set; }
        public string TournamentName { get; set; } = string.Empty;
        public int HorseId { get; set; }
        public string HorseName { get; set; } = string.Empty;
        public int JockeyId { get; set; }
        public string JockeyName { get; set; } = string.Empty;
        public int OwnerId { get; set; }
        public string OwnerName { get; set; } = string.Empty;

        public decimal Amount { get; set; }
        public string Method { get; set; } = string.Empty;
        public string? ReceiptNo { get; set; }
        public string? TransferRef { get; set; }

        // Tên file gốc để hiển thị; NULL nghĩa là không đính kèm chứng từ.
        public string? ProofFileName { get; set; }
        public bool HasProof { get; set; }

        public string Status { get; set; } = string.Empty;
        public DateTime SubmittedAt { get; set; }
        public int? VerifiedBy { get; set; }
        public DateTime? VerifiedAt { get; set; }
        public string? RejectReason { get; set; }

        // Trạng thái pairing sau thao tác — FE cần để cập nhật wizard của Owner.
        public string PairingStatus { get; set; } = string.Empty;
    }
}
