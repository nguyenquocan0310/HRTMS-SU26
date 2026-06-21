namespace HRTMS.Core.DTOs.Reconciliation;

public class TransactionDto
{
    public int TransactionId { get; set; }

    public int Amount { get; set; }

    public string Type { get; set; } = null!;

    public string? ReferenceId { get; set; }

    public DateTime CreatedAt { get; set; }
}