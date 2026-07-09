using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.RaceEntry;

// Owner chủ động rút lui. Lý do là tùy chọn (ví dụ sức khỏe ngựa).
public class WithdrawEntryDto
{
    [MaxLength(255)]
    public string? Reason { get; set; }
}
