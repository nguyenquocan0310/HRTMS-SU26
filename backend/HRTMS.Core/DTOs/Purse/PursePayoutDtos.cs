using System;
using System.Collections.Generic;

namespace HRTMS.Core.DTOs.Purse
{
	// ===========================================================================
	// Một dòng phân bổ tiền thưởng (UI-S14: người nhận, vai trò,
	// vị trí, số tiền, trạng thái chi trả). Chỉ ĐỌC + cập nhật trạng thái Paid/Unpaid.
	// ===========================================================================
	public class PursePayoutItemDto
	{
		public int PursePayoutId { get; set; }
		public int RaceEntryId { get; set; }

		public int RecipientUserId { get; set; }
		public string RecipientName { get; set; } = string.Empty;
		public string Role { get; set; } = string.Empty;       // "Owner" | "Jockey"

		// Bối cảnh hiển thị: ngựa nào, về vị trí mấy
		public int? FinishPosition { get; set; }
		public string HorseName { get; set; } = string.Empty;

		public decimal CalculatedAmount { get; set; }
		public string PayoutStatus { get; set; } = string.Empty; // "Unpaid" | "Paid"
		public DateTime? PaidAt { get; set; }
		public int? UpdatedByAdminId { get; set; }
		public DateTime UpdatedAt { get; set; }
	}

	// ===========================================================================
	// Bảng phân bổ Purse của 1 cuộc đua kèm dòng Remainder.
	// RemainderAmount tính ON-THE-FLY = PurseAmount − SUM(CalculatedAmount),
	// KHÔNG lưu cột DB (theo quyết định đã chốt). Phần dư khi số ngựa
	// về đích hợp lệ < số vị trí thưởng — Admin xử lý thủ công ngoài hệ thống.
	// ===========================================================================
	public class RacePayoutSummaryDto
	{
		public int RaceId { get; set; }
		public int RaceNumber { get; set; }
		public string RoundName { get; set; } = string.Empty;
		public string TournamentName { get; set; } = string.Empty;
		public string RaceStatus { get; set; } = string.Empty;   // chỉ "Official" mới có payout

		public decimal PurseAmount { get; set; }
		public decimal TotalAllocated { get; set; }               // SUM(CalculatedAmount)
		public decimal RemainderAmount { get; set; }              // PurseAmount − TotalAllocated

		public List<PursePayoutItemDto> Payouts { get; set; } = new();
	}

	// ===========================================================================
	// Request: Admin đổi trạng thái chi trả (UI-S14 nút "Đánh dấu Paid").
	// HRTMS chỉ cập nhật trạng thái lý thuyết — KHÔNG xử lý dòng tiền thật (2.5.1).
	// ===========================================================================
	public class MarkPayoutStatusDto
	{
		public string PayoutStatus { get; set; } = string.Empty; // "Paid" | "Unpaid"
	}

	// ===========================================================================
	// Lịch sử tiền thưởng tích lũy cho từng Chủ ngựa / Nài ngựa.
	// ===========================================================================
	public class EarningsHistoryItemDto
	{
		public int RecipientUserId { get; set; }
		public string RecipientName { get; set; } = string.Empty;
		public string Role { get; set; } = string.Empty;        // "Owner" | "Jockey"

		public decimal TotalEarnings { get; set; }              // SUM tất cả payout
		public decimal PaidAmount { get; set; }                 // SUM đã Paid
		public decimal UnpaidAmount { get; set; }               // SUM còn Unpaid
		public int PayoutCount { get; set; }
	}
}
