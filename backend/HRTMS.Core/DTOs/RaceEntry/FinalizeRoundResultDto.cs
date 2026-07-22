namespace HRTMS.Core.DTOs.RaceEntry;

// Kết quả POST /api/admin/rounds/{id}/finalize — chốt danh sách rồi bốc thăm
// toàn bộ race của vòng.
public class FinalizeRoundResultDto
{
    public int RoundId { get; set; }

    public AutoAllocateResultDto Allocation { get; set; } = new();

    public List<PostPositionDrawResultDto> Draws { get; set; } = new();

    // Race không bốc thăm được và lý do (vd NOT_ENOUGH_ENTRIES) — allocate vẫn
    // giữ nguyên, Admin xử lý từng race sau.
    public List<FinalizeSkippedRaceDto> SkippedDraws { get; set; } = new();
}

public class FinalizeSkippedRaceDto
{
    public int RaceId { get; set; }

    public int RaceNumber { get; set; }

    public string Reason { get; set; } = string.Empty;
}
