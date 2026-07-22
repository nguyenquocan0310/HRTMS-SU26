using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.RaceEntry;

// Admin chuyển một RaceEntry sang race khác TRONG CÙNG vòng (manual override
// sau auto-allocate).
public class MoveEntryDto
{
    [Range(1, int.MaxValue)]
    public int TargetRaceId { get; set; }
}
