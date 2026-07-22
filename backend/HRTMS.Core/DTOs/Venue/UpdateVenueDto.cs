using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Venue
{
    // Admin cập nhật sân. Mọi field optional — chỉ field truyền lên mới bị ghi đè,
    // tránh vô tình reset LaneCount/IsActive khi FE chỉ sửa địa chỉ.
    public class UpdateVenueDto
    {
        [MaxLength(200)]
        public string? Name { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        public string? TrackType { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "TrackLengthMeters must be greater than 0")]
        public int? TrackLengthMeters { get; set; }

        [Range(2, 24, ErrorMessage = "LaneCount must be between 2 and 24")]
        public int? LaneCount { get; set; }

        public bool? IsActive { get; set; }
    }
}
