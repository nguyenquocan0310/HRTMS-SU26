using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Reconciliation;

namespace HRTMS.Core.Interfaces.Services;

public interface IReconciliationService
{
    // UI-S35 — lịch sử dự đoán + đối chiếu kết quả
    Task<ApiResponse<List<PredictionHistoryDto>>> GetMyPredictionsAsync(int spectatorId);

    // UI-S34 — số dư ví + 50 giao dịch gần nhất (trang đầu)
    Task<ApiResponse<WalletDto>> GetMyWalletAsync(int spectatorId);

    // FIX #5: Phân trang lịch sử giao dịch — tránh load toàn bộ vào memory
    Task<ApiResponse<PagedResult<TransactionDto>>> GetMyTransactionsAsync(int spectatorId, int page, int pageSize);
}