namespace HRTMS.Core.DTOs.Jockey;

// Thong ke career cua Jockey — dung chung cho ca "xem career cua chinh minh"
// va "xem career cua 1 Jockey bat ky" (Owner chon Jockey, Admin, v.v.)
// Chi tinh tren cac RaceEntry thuoc Race da co ket qua chinh thuc (Race.Status == "Official"),
// vi FinishPosition/PointsAwarded/EarningsAwarded chi dang tin cay sau khi Official.
public class JockeyCareerStatsDto
{
    public int JockeyId { get; set; }

    public string FullName { get; set; } = string.Empty;

    // Tong so race da co ket qua chinh thuc (khong tinh entry bi rut lui — IsWithdrawn)
    public int TotalRaces { get; set; }

    public int Wins { get; set; }          // FinishPosition == 1
    public int Podiums { get; set; }       // FinishPosition <= 3

    // Ty le, tinh tren TotalRaces; null neu TotalRaces == 0 de tranh chia cho 0 o FE
    public double? WinRate { get; set; }
    public double? PodiumRate { get; set; }

    public double? AverageFinishPosition { get; set; }

    public int TotalPoints { get; set; }
    public decimal TotalEarnings { get; set; }
}