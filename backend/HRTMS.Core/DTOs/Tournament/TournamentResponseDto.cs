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
        public string AllowedBreed { get; set; } = string.Empty;
        public string TrackType { get; set; } = string.Empty;
        public int RaceDistance { get; set; }
        public string RaceCategory { get; set; } = string.Empty;
        public int MinJockeyExperienceYears { get; set; }
        public decimal PurseAmount { get; set; }
        // Tổng PurseAmount đã phân bổ cho các Race (SUM qua mọi Round).
        public decimal AllocatedPurse { get; set; }
        // Phần quỹ giải còn lại chưa phân bổ cho Race nào = PurseAmount - AllocatedPurse.
        public decimal RemainingPurse { get; set; }
        public decimal EntryFeeAmount { get; set; }
        public decimal PreRaceWeightThresholdKg { get; set; }
        public decimal PostRaceWeightDiffThresholdKg { get; set; }
        public string Status { get; set; } = string.Empty;
        // Sân đua (patch 011). NULL với giải cũ tạo trước patch — FE phải chịu được null.
        public int? VenueId { get; set; }
        public string? VenueName { get; set; }
        public string? VenueCity { get; set; }
        public int? LaneCount { get; set; }
        public int? TrackLengthMeters { get; set; }
        // Sức chứa thực tế mỗi cuộc đua = min(MaxHorses, LaneCount).
        public int? RaceCapacity { get; set; }
        // Progression (patch 002)
        public string AdvancementRule { get; set; } = "TopPerRace";
        public int AdvancementCount { get; set; } = 5;
        public DateTime CreatedAt { get; set; }
        public List<RoundResponseDto> Rounds { get; set; } = new();
        public List<PrizeDistributionResponseDto> PrizeDistributions { get; set; } = new();
    }
}
