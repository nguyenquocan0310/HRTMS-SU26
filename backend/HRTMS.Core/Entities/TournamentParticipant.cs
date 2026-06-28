using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

/// <summary>
/// Roster thành viên theo từng giải đấu (Owner/Jockey/Doctor/Referee).
/// Duyệt chứng chỉ/bằng cấp là GLOBAL (Module A); bản ghi này chỉ quản lý
/// việc THAM GIA một giải cụ thể — Admin duyệt Pending → Approved.
/// Mọi API chọn người (owner mời jockey, admin phân công doctor/referee)
/// đều tham chiếu roster Approved của giải.
/// </summary>
public partial class TournamentParticipant
{
    public int ParticipantId { get; set; }

    public int TournamentId { get; set; }

    public int UserId { get; set; }

    /// <summary>Owner | Jockey | Doctor | Referee (denormalize từ User.Role để lọc nhanh).</summary>
    public string Role { get; set; } = null!;

    /// <summary>Pending | Approved | Rejected | ManualReview.</summary>
    public string Status { get; set; } = null!;

    /// <summary>
    /// Kết quả auto-screening roster (TRN.11): NotScreened | AutoEligible | ManualReview | AutoRejected.
    /// Owner Active → AutoEligible + Approved ngay; Jockey/Referee/Doctor AutoEligible chỉ vào bulk approval queue.
    /// </summary>
    public string ScreeningStatus { get; set; } = "NotScreened";

    /// <summary>Lý do hệ thống đưa ra khi screen (đặc biệt khi ManualReview / AutoRejected).</summary>
    public string? ScreeningReason { get; set; }

    public string? RejectionReason { get; set; }

    public DateTime RegisteredAt { get; set; }

    public int? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public virtual Tournament Tournament { get; set; } = null!;

    public virtual User User { get; set; } = null!;

    public virtual User? ApprovedByNavigation { get; set; }
}
