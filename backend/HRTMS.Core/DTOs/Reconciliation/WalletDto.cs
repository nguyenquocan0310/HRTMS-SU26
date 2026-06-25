namespace HRTMS.Core.DTOs.Reconciliation;

public class WalletDto
{
    public int WalletId { get; set; }

    public int Balance { get; set; }

    // Chỉ trả về trang đầu (50 giao dịch gần nhất).
    // Dùng GET /reconciliation/wallet/transactions?page=N để xem thêm.
    public List<TransactionDto> Transactions { get; set; } = new();

    public int TotalTransactions { get; set; }
}