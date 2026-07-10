namespace HRTMS.Core.DTOs.RaceEntry;

// Kết quả hủy một cuộc đua (Module E — nhánh hủy race của SCH.9).
public class CancelRaceResultDto
{
    public int RaceId { get; set; }

    public string Status { get; set; } = "Cancelled";

    // Số entry active (Pending/Confirmed) đã bị hủy kèm race.
    public int CancelledEntries { get; set; }

    // Số prediction Pending đã được hoàn điểm về ví.
    public int RefundedPredictions { get; set; }
}
