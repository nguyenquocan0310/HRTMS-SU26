using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

/// <summary>
/// Schema v3 — Enrollment: 1 dòng cho mỗi cặp (Horse, Tournament).
/// Mang kết quả screening + AdminApproval THEO TỪNG GIẢI (duyệt lại mỗi giải).
/// Owner "đẩy" một con ngựa trong kho vào một giải = tạo một bản ghi ở đây.
/// </summary>
public partial class HorseTournamentEntry
{
    public int EnrollmentId { get; set; }

    public int HorseId { get; set; }

    public int TournamentId { get; set; }

    /// <summary>Denormalized = Horse.OwnerId — neo composite-FK roster-check (TournamentId, OwnerId).</summary>
    public int OwnerId { get; set; }

    /// <summary>'Enrolled' | 'Withdrawn'.</summary>
    public string Status { get; set; } = null!;

    /// <summary>'NotScreened' | 'AutoEligible' | 'ManualReview' | 'AutoRejected'.</summary>
    public string ScreeningStatus { get; set; } = null!;

    public string? ScreeningReason { get; set; }

    /// <summary>'Pending' | 'Approved' | 'Rejected'.</summary>
    public string AdminApprovalStatus { get; set; } = null!;

    public string? RejectionReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Horse Horse { get; set; } = null!;

    public virtual Tournament Tournament { get; set; } = null!;
}
