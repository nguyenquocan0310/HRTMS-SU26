using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
//Shape data tra ve cho client khi GET tournament
// Khac CreateTournamentDto o cho: co them TournamentId, Status, CreateAt,
// va nested list Rounds + PrizeDistributions.
// Client can nhung field nay de hien thi 
namespace HRTMS.Core.DTOs.Tournament
{
    public class TournamentResponseDto
    {
        public int TournamentId { get; set;  }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int MaxHorses { get; set; }
        public string AllowBreed { get; set; } = string.Empty;
        public string TrackType { get; set; } = string.Empty;
        public int RaceDistance { get; set; }
        public string RaceCatgory { get; set; } = string.Empty;
        public int MinJockeyExperienceYears { get; set; }
        public decimal PurseAmount { get; set; }
        public decimal EntryFeeAmount { get; set; }
        public decimal PreRaceWeightThresholdKg { get; set; }
        public decimal PostRaceWeightThresholdKg { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public List<RoundResponseDto> Rounds { get; set; } = new();
        public List<PrizeDistributionResponseDto> PrizeDistributions { get; set; } = new();
    }
}
