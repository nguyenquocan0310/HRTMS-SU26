using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Reconciliation;

namespace HRTMS.Core.Interfaces.Services;

public interface IReconciliationService
{
    // UI-S35 — lịch sử dự đoán + đối chiếu kết quả
    Task<ApiResponse<List<PredictionHistoryDto>>> GetMyPredictionsAsync(int spectatorId);

    // UI-S34 — số dư ví + lịch sử giao dịch
    Task<ApiResponse<WalletDto>> GetMyWalletAsync(int spectatorId);
}