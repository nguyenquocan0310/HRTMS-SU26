using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// Nhận data khi Admin tạo mới giải đấu
// Client POST lên body này. Server đọc, validate rồi map sang Entity
// để lưu DB. Chỉ có những field sau Admin được phép điền - không bao gồm
// status, createdAt, tournamentId
namespace HRTMS.Core.DTOs.Tournament
{
    public class CreateTournamentDto
    {
        [Required, MaxLength(200)] 
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        public DateTime StartDate { get; set; }
        [Required]
        public DateTime EndDate { get; set; }
        [Range(1, int.MaxValue, ErrorMessage ="MaxHorses must above 0")]
        public int MaxHorses { get; set; }

        // Sân đua (patch 011) — BẮT BUỘC cho giải mới. Venue.LaneCount là trần cứng
        // của MaxHorses; TrackType của giải được suy ra từ sân, không nhận tự do.
        [Range(1, int.MaxValue, ErrorMessage = "VenueId is required")]
        public int VenueId { get; set; }

        // Single-select, 4 giá trị hợp lệ
        [Required]
        public string AllowedBreed { get; set; } = string.Empty;
        [Required]
        public string TrackType { get; set; } = string.Empty;
        [Range(1201, 2399, ErrorMessage = "RaceDistance must be greater than 1200 and less than 2400")]
        public int RaceDistance { get; set; }
        [Required]
        public string RaceCategory { get; set; } = string.Empty;
        [Range(0,50)]
        public int MinJockeyExperienceYears { get; set; }

        // Tổng quỹ giải
        [Range(0, double.MaxValue)]
        public decimal PurseAmount { get; set;  }
        // 0 = miễn phí
        [Range(0, double.MaxValue)]
        public decimal EntryFeeAmount { get; set; } = 0;
        // Ngưỡng cân nặng
        public decimal PreRaceWeightThresholdKg { get; set; } = 2.0m;
        public decimal PostRaceWeightDiffThresholdKg { get; set; } = 1.0m;

        // Progression (patch 002) - rule di tiep chung cho giai.
        // Khong truyen -> dung default entity: AdvancementRule="TopPerRace", AdvancementCount=5.
        public string? AdvancementRule { get; set; }
        [Range(1, int.MaxValue, ErrorMessage = "AdvancementCount must be greater than 0")]
        public int? AdvancementCount { get; set; }
    }
}
