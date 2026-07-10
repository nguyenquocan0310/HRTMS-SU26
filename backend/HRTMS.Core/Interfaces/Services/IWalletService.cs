using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Wallet;

namespace HRTMS.Core.Interfaces.Services;

public interface IWalletService
{
    /// <summary>
    /// Spectator redeem mã vé thưởng → cộng điểm ảo + ghi ledger `Ticket Code Bonus`
    /// trong cùng một database transaction. Mỗi code chỉ redeem được một lần (BR-63).
    /// </summary>
    Task<ApiResponse<RedeemTicketCodeResponseDto>> RedeemTicketCodeAsync(
        int spectatorId, RedeemTicketCodeDto dto, string? ipAddress);
}
