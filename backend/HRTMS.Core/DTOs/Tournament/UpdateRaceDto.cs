using System.ComponentModel.DataAnnotations;

// Nhan data khi cap nhat cau hinh mot Race.
// PUT /api/races/{raceId}
// SCH.9/EC-48: cac truong ScheduledTime, TrackTypeOverride, RaceDistanceOverride bi DONG BANG
// sau khi da boc tham (IsPostPositionDrawn) hoac da co Prediction.
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
