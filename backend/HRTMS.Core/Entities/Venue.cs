using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

// Sân đua vật lý (patch 011). LaneCount là trần cứng cho sức chứa mỗi cuộc đua —
// không thể xếp nhiều ngựa hơn số cổng xuất phát của sân.
public partial class Venue
{
    public int VenueId { get; set; }

    public string Name { get; set; } = null!;

    public string? Address { get; set; }

    public string? City { get; set; }

    public string TrackType { get; set; } = null!;

    public int TrackLengthMeters { get; set; }

    public int LaneCount { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Tournament> Tournaments { get; set; } = new List<Tournament>();
}
