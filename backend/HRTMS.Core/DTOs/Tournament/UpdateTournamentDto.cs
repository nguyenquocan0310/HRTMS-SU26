using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// Nhận data khi Admin update giải đấu
// Tất cả field đều nullable (string?, int?) vì Admin có thể chỉ sửa 1
// field, các field còn lại không gửi lên thì giữ nguyên trong DB
namespace HRTMS.Core.DTOs.Tournament
{
    public class UpdateTournamentDto
    {
        [MaxLength(200)]
        public string? Name { get; set; }
        public string? Description { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? MaxHorses { get; set; }
        // Sân đua (patch 011). Đổi sân bị khóa khi giải đã Open Registration —
        // số làn của sân quyết định sức chứa mà enrollment đã được xét theo.
        public int? VenueId { get; set; }
        public string? AllowedBreed { get; set; }
        public string? TrackType { get; set; }
        public int? RaceDistance { get; set; }
        public string? RaceCategory { get; set; }
        public int? MinJockeyExperienceYears { get; set; }
        public decimal? PurseAmount { get; set; }
        public decimal? EntryFeeAmount { get; set; }

        // Deadline lệ phí (patch 012). Chỉ sửa được khi giải còn Draft/Open
        // Registration VÀ chưa qua PaymentDeadline hiện tại (job đã chạy thì khóa).
        public DateTime? PaymentDeadline { get; set; }

        // Gửi RefundDeadline = null KHÔNG xóa được giá trị cũ (không phân biệt được
        // "không gửi" với "gửi null") — dùng ClearRefundDeadline = true để bỏ hoàn phí.
        public DateTime? RefundDeadline { get; set; }

        public bool ClearRefundDeadline { get; set; }
        public decimal? PreRaceWeightThresholdKg { get; set; }
        public decimal? PostRaceWeightDiffThresholdKg { get; set; }

        // Progression (patch 002) - chi cho sua truoc khi Closed Registration / truoc race Official.
        public string? AdvancementRule { get; set; }
        [Range(1, int.MaxValue, ErrorMessage = "AdvancementCount must be greater than 0")]
        public int? AdvancementCount { get; set; }
    }
}
