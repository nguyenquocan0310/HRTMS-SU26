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

        public string? TrackTypeOverride { get; set;  }
        public int? RaceDistanceOverride { get; set; }
        public int ConfirmationCuroffHours { get; set; } = 24;
        public int ProtestDeadlineMinutes { get; set; } = 30; 

    }
}
