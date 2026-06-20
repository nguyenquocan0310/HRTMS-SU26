using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.DTOs.Horse
{
    public class RaceEntryResponseDto
    {
        public int RaceEntryId { get; set; }
        public RaceEntryRaceDto Race { get; set; } = null!;
        public RaceEntryHorseDto Horse { get; set; } = null!;
        public RaceEntryJockeyDto Jockey { get; set; } = null!;
        public string Status { get; set; } = null!;
        public string EntryFeeStatus { get; set; } = null!;
        public decimal EntryFeeAmount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class RaceEntryRaceDto
    {
        public int RaceId { get; set; }
        public int RaceNumber { get; set; }
        public DateTime ScheduledTime { get; set; }
        public string? TournamentName { get; set; }
    }

    public class RaceEntryHorseDto
    {
        public int HorseId { get; set; }
        public string Name { get; set; } = null!;
    }

    public class RaceEntryJockeyDto
    {
        public int JockeyId { get; set; }
        public string FullName { get; set; } = null!;
    }
}
