using System;
using System.Collections.Generic;

namespace HRTMS.Core.DTOs.Purse
{
	// ===========================================================================
	// Quỹ thưởng tổng hợp cấp Cuộc đua / Vòng đấu / Giải đấu (Module K).
	//
	// Công thức chốt (áp dụng thống nhất cả 3 cấp):
	//   remainingAmount = allocatedFund − paidAmount − pendingAmount
	//   paidAmount    = SUM(PursePayouts.CalculatedAmount) trong phạm vi, PayoutStatus = "Paid"
	//   pendingAmount = SUM(PursePayouts.CalculatedAmount) trong phạm vi, PayoutStatus = "Unpaid"
	//
	// PursePayout chỉ được tạo khi Declare Official (ResultService.AllocatePurse) —
	// nên race/round/giải CHƯA kết thúc không có payout nào => remaining tự động
	// giữ nguyên full ngân sách của phần đó. Đây là lý do tại sao "chỉ trừ quỹ của
	// cuộc đua đã công bố kết quả" đúng MÀ KHÔNG CẦN thêm cột persist nào —
	// remaining luôn tính động từ chính PursePayouts hiện có.
	//
	// Discrepancy: nếu paid+pending vượt allocatedFund (dữ liệu bất thường), KHÔNG
	// âm thầm clamp remaining về 0 rồi làm mất phần chênh lệch — expose rõ qua
	// HasDiscrepancy/DiscrepancyAmount để Admin biết.
	// ===========================================================================

	public class RacePurseSummaryDto
	{
		public int RaceId { get; set; }
		public int RaceNumber { get; set; }
		public string RaceName { get; set; } = string.Empty; // "Race {RaceNumber}" — hiển thị FE
		public string RoundName { get; set; } = string.Empty;
		public string TournamentName { get; set; } = string.Empty;

		public decimal AllocatedFund { get; set; }     // Race.PurseAmount
		public decimal PaidAmount { get; set; }
		public decimal PendingAmount { get; set; }
		public decimal RemainingAmount { get; set; }

		// "NotOfficial" (chưa công bố, chưa có payout) | "Pending" (có payout Unpaid)
		// | "Paid" (mọi payout đã Paid) | "Cancelled"
		public string PayoutStatus { get; set; } = string.Empty;
		public string ResultStatus { get; set; } = string.Empty; // Race.Status thật (Upcoming/.../Official/Cancelled)

		public bool HasDiscrepancy { get; set; }
		public decimal? DiscrepancyAmount { get; set; } // paid+pending − allocatedFund khi dương

		public List<PursePayoutItemDto> Payouts { get; set; } = new();
	}

	public class RoundPurseSummaryDto
	{
		public int RoundId { get; set; }
		public string RoundName { get; set; } = string.Empty;
		public string TournamentName { get; set; } = string.Empty;
		public string RoundStatus { get; set; } = string.Empty;

		public decimal AllocatedFund { get; set; }     // SUM(Race.PurseAmount) trong vòng
		public decimal PaidAmount { get; set; }
		public decimal PendingAmount { get; set; }
		public decimal RemainingAmount { get; set; }

		public int PaidRaceCount { get; set; }         // race Official, mọi payout đã Paid
		public int TotalRaceCount { get; set; }

		public bool HasDiscrepancy { get; set; }

		public List<RacePurseSummaryItemDto> Races { get; set; } = new();
	}

	// Dòng con rút gọn dùng trong RoundPurseSummaryDto/TournamentPurseSummaryDto
	// (không kèm chi tiết từng payout — muốn xem chi tiết thì gọi race-purse-summary riêng).
	public class RacePurseSummaryItemDto
	{
		public int RaceId { get; set; }
		public int RaceNumber { get; set; }
		public decimal AllocatedFund { get; set; }
		public decimal PaidAmount { get; set; }
		public decimal PendingAmount { get; set; }
		public decimal RemainingAmount { get; set; }
		public string PayoutStatus { get; set; } = string.Empty;
		public string ResultStatus { get; set; } = string.Empty;
		public bool HasDiscrepancy { get; set; }
	}

	public class RoundPurseSummaryItemDto
	{
		public int RoundId { get; set; }
		public string RoundName { get; set; } = string.Empty;
		public string RoundStatus { get; set; } = string.Empty;
		public decimal AllocatedFund { get; set; }
		public decimal PaidAmount { get; set; }
		public decimal PendingAmount { get; set; }
		public decimal RemainingAmount { get; set; }
		public int PaidRaceCount { get; set; }
		public int TotalRaceCount { get; set; }
		public bool HasDiscrepancy { get; set; }
	}

	public class TournamentPurseSummaryDto
	{
		public int TournamentId { get; set; }
		public string TournamentName { get; set; } = string.Empty;
		public string TournamentStatus { get; set; } = string.Empty;

		public decimal TotalFund { get; set; }         // Tournament.PurseAmount
		public decimal PaidAmount { get; set; }
		public decimal PendingAmount { get; set; }
		public decimal RemainingAmount { get; set; }

		public int PaidRaceCount { get; set; }
		public int TotalRaceCount { get; set; }
		public int CompletedRoundCount { get; set; }
		public int TotalRoundCount { get; set; }

		public bool HasDiscrepancy { get; set; }

		public List<RoundPurseSummaryItemDto> Rounds { get; set; } = new();
	}
}
