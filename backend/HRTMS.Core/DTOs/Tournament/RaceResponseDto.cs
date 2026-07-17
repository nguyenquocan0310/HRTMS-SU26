using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// Trả về thông tin một Race.
namespace HRTMS.Core.DTOs.Tournament
{
    public class RaceResponseDto
    {
        public int RaceId { get; set; }
        public int RoundId { get; set; }
        public int RaceNumber { get; set; }
        public DateTime ScheduledTime { get; set; }
        public decimal PurseAmount { get; set; }
        public string? TrackTypeOverride { get; set; }
        public int? RaceDistanceOverride { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsPostPositionDrawn { get; set; }
        public int ConfirmationCutoffHours { get; set; }
        public int ProtestDeadlineMinutes { get; set; }

    }
}
