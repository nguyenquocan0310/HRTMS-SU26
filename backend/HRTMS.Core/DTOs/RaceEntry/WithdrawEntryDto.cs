using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.RaceEntry;

// SCH.5 — Owner chu dong rut lui. Ly do la tuy chon (vi du suc khoe ngua).
public class WithdrawEntryDto
{
    [MaxLength(255)]
    public string? Reason { get; set; }
}
