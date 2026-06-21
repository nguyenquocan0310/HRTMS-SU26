namespace HRTMS.Core.DTOs.Reconciliation;

public class WalletDto
{
    public int WalletId { get; set; }

    public int Balance { get; set; }

    public List<TransactionDto> Transactions { get; set; } = new();
}