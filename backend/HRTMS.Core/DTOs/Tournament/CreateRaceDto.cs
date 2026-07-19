using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// Nhan data khi tao mot cuoc dua cu the ben trong Round
// POST/round/{id}/races
namespace HRTMS.Core.DTOs.Tournament
{
    public class CreateRaceDto
    {
        [Range(1, int.MaxValue)]
        public int RaceNumber { get; set; }
        [Required]
        public DateTime ScheduledTime { get; set; }
        [Range(0, double.MaxValue)]
        public decimal PurseAmount { get; set; }

        public string? TrackTypeOverride { get; set; }
        [Range(1201, 2399, ErrorMessage = "RaceDistanceOverride must be greater than 1200 and less than 2400")]
        public int? RaceDistanceOverride { get; set; }
        public int ConfirmationCutoffHours { get; set; } = 24;
        [Range(1, int.MaxValue)]
        public int ProtestDeadlineMinutes { get; set; } = 10;

    }
}