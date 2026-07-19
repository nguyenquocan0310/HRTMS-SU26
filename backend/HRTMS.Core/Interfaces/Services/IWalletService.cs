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

    /// <summary>
    /// Admin tạo batch mã vé thưởng: sinh raw code an toàn, lưu plaintext, trả về danh sách code.
    /// Toàn bộ batch trong một transaction — lỗi bất kỳ code nào → rollback cả batch.
    /// </summary>
    Task<ApiResponse<CreateTicketCodesResponseDto>> CreateTicketCodesAsync(
        int adminId, CreateTicketCodesDto dto, string? ipAddress);

    /// <summary>
    /// Admin xem danh sách mã vé thưởng đã tạo (có phân trang + lọc theo trạng thái).
    /// status: Active | Redeemed | Expired | null (tất cả).
    /// </summary>
    Task<ApiResponse<TicketCodeListResponseDto>> GetTicketCodesAsync(
        string? status, int page, int pageSize);
}
