using System.ComponentModel.DataAnnotations;

// Nhận data khi cập nhật cấu hình một Race.
// PUT /api/races/{raceId}
// Các trường ScheduledTime, TrackTypeOverride, RaceDistanceOverride bị ĐÓNG BĂNG
// sau khi đã bốc thăm (IsPostPositionDrawn) hoặc đã có Prediction.
namespace HRTMS.Core.DTOs.Tournament
{
    public class UpdateRaceDto
    {
        [Required]
        public DateTime ScheduledTime { get; set; }

        [Range(0, double.MaxValue)]
        public decimal PurseAmount { get; set; }

        public string? TrackTypeOverride { get; set; }
        [Range(1201, 2399, ErrorMessage = "RaceDistanceOverride must be greater than 1200 and less than 2400")]
        public int? RaceDistanceOverride { get; set; }
        public int ConfirmationCutoffHours { get; set; } = 24;
        public int ProtestDeadlineMinutes { get; set; } = 120;
    }
}
