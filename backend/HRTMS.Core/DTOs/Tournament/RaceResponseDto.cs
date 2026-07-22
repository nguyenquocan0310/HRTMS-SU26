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
        // DEPRECATED (patch 012/013 flow): hạn Owner tự xác nhận entry không còn là
        // bước bắt buộc — xác nhận nay đến từ verify lệ phí. Cột giữ lại để không
        // vỡ contract cũ; FE mới không nên hiển thị.
        public int ConfirmationCutoffHours { get; set; }
        public int ProtestDeadlineMinutes { get; set; }

        // Sân đua (patch 011) — kế thừa từ giải. NULL với giải cũ chưa gán sân.
        public string? VenueName { get; set; }
        public string? VenueCity { get; set; }
        public string? VenueTrackType { get; set; }
        public int? LaneCount { get; set; }
        public int? TrackLengthMeters { get; set; }
        // Sức chứa cuộc đua = min(Tournament.MaxHorses, Venue.LaneCount).
        public int? RaceCapacity { get; set; }
    }
}
