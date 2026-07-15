namespace HRTMS.Core.DTOs.Reconciliation;

public class PredictionHistoryDto
{
    public int PredictionId { get; set; }

    public int RaceId { get; set; }

    public string RaceName { get; set; } = null!;

    public string HorseName { get; set; } = null!;

    public string PredictionType { get; set; } = null!;

    public int PointsPlaced { get; set; }

    public string Status { get; set; } = null!;

    public int? PointsAwarded { get; set; }

    /// <summary>
    /// Vị trí về đích thực tế của con ngựa được đoán (null nếu race chưa Official
    /// hoặc ngựa bị Cancelled/Disqualified) — REQ-F-REC.3 "kết quả thực tế".
    /// </summary>
    public int? ActualFinishPosition { get; set; }

    /// <summary>
    /// Tên (các) ngựa về Nhất chính thức của cuộc đua (đồng hạng thì nối bằng ", ").
    /// Giúp Spectator đối chiếu trực quan mà không cần tra thêm — REQ-F-REC.3.
    /// </summary>
    public string? WinningHorseName { get; set; }

    public DateTime CreatedAt { get; set; }
}