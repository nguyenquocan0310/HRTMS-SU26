namespace HRTMS.Core.DTOs.Venue
{
    // Shape trả về cho client khi GET venue. LaneCount/TrackLengthMeters là thông tin
    // FE cần để hiển thị sức chứa và cảnh báo trước khi Admin chọn sân cho giải.
    public class VenueResponseDto
    {
        public int VenueId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? City { get; set; }
        public string TrackType { get; set; } = string.Empty;
        public int TrackLengthMeters { get; set; }
        public int LaneCount { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
