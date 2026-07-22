using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Venue
{
    // Admin tạo sân đua mới. TrackType/LaneCount khớp CHECK constraint ở DB
    // (CHK_Venues_TrackType, CHK_Venues_LaneCount) để lỗi bị chặn ở tầng validate
    // thay vì nổ ra thành DbUpdateException.
    public class CreateVenueDto
    {
        [Required, MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [Required]
        public string TrackType { get; set; } = string.Empty;

        [Range(1, int.MaxValue, ErrorMessage = "TrackLengthMeters must be greater than 0")]
        public int TrackLengthMeters { get; set; }

        [Range(2, 24, ErrorMessage = "LaneCount must be between 2 and 24")]
        public int LaneCount { get; set; }

        public bool IsActive { get; set; } = true;
    }
}
