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

    public DateTime CreatedAt { get; set; }
}