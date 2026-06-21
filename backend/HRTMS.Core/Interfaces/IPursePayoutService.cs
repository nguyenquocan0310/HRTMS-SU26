using HRTMS.Core.DTOs.Purse;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services
{
	public interface IPursePayoutService
	{
		// REQ-F-PRZ.6 + PRZ.4 — Lấy bảng phân bổ Purse + dòng Remainder của 1 cuộc đua (UI-S14)
		Task<RacePayoutSummaryDto> GetRacePayoutsAsync(int raceId);

		// REQ-F-PRZ.6 — Đổi trạng thái Paid/Unpaid; set/clear PaidAt + ghi AuditLog
		Task<PursePayoutItemDto> UpdatePayoutStatusAsync(int payoutId, MarkPayoutStatusDto dto, int adminUserId);

		// REQ-F-PRZ.6 — Lịch sử thưởng tích lũy theo người nhận (lọc tùy chọn userId/role)
		Task<List<EarningsHistoryItemDto>> GetEarningsHistoryAsync(int? recipientUserId, string? role);
	}
}
