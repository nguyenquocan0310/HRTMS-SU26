using HRTMS.Core.DTOs.Purse;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services
{
	public interface IPursePayoutService
	{
		// Lấy bảng phân bổ Purse + dòng Remainder của 1 cuộc đua (UI-S14)
		Task<RacePayoutSummaryDto> GetRacePayoutsAsync(int raceId);

		// Đổi trạng thái Paid/Unpaid; set/clear PaidAt + ghi AuditLog
		Task<PursePayoutItemDto> UpdatePayoutStatusAsync(int payoutId, MarkPayoutStatusDto dto, int adminUserId);

		// Lịch sử thưởng tích lũy theo người nhận (lọc tùy chọn userId/role)
		Task<List<EarningsHistoryItemDto>> GetEarningsHistoryAsync(int? recipientUserId, string? role);

		// Owner tự xem tiền thưởng của mình (self-scoped, id lấy từ JWT)
		Task<OwnerEarningsDto> GetMyEarningsAsync(int ownerUserId);

		// Quỹ tổng hợp cấp giải/vòng/cuộc đua (PRZ.5) — RBAC theo userId/role lấy từ JWT.
		Task<TournamentPurseSummaryDto> GetTournamentPurseSummaryAsync(int tournamentId, int userId, string role);
		Task<RoundPurseSummaryDto> GetRoundPurseSummaryAsync(int roundId, int userId, string role);
		Task<RacePurseSummaryDto> GetRacePurseSummaryAsync(int raceId, int userId, string role);
	}
}
