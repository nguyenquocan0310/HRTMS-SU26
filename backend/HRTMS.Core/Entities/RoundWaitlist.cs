using System;

namespace HRTMS.Core.Entities;

// Danh sách chờ theo vòng (patch 013).
// Lưu phần dư khi pool đủ điều kiện vượt tổng sức chứa của vòng.
//
// KHÁC AlsoEligible: AlsoEligible là RaceEntries.AdvancementStatus nên chỉ tồn tại
// khi pairing ĐÃ có entry ở một race. Vòng 1 chưa có entry nào — RoundWaitlist là
// chỗ duy nhất lưu được danh sách chờ của vòng đó.
public partial class RoundWaitlist
{
    public int WaitlistId { get; set; }

    public int RoundId { get; set; }

    public int PairingId { get; set; }

    // Thứ tự ưu tiên gọi bù, 1 = gọi trước. Duy nhất trong mỗi vòng.
    public int Position { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Round Round { get; set; } = null!;

    public virtual Pairing Pairing { get; set; } = null!;
}
