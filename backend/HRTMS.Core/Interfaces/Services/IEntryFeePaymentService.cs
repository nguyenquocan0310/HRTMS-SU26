using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Payment;
using Microsoft.AspNetCore.Http;

namespace HRTMS.Core.Interfaces.Services
{
    // Module E/N — nộp & đối chiếu lệ phí (patch 013).
    public interface IEntryFeePaymentService
    {
        Task<FeePaymentResponseDto> SubmitAsync(
            int ownerId, int pairingId, SubmitFeePaymentDto dto, IFormFile? proofFile);

        Task<PagedResult<FeePaymentResponseDto>> GetForAdminAsync(
            string? status, int? tournamentId, int page, int pageSize);

        // Admin theo dõi TẤT CẢ pairing, gồm cả cặp chưa từng nộp lệ phí.
        Task<PagedResult<AdminFeePairingDto>> GetPairingsForAdminAsync(
            string? paymentStatus, int? tournamentId, int page, int pageSize);

        Task<FeePaymentResponseDto> VerifyAsync(int adminId, int paymentId);

        Task<FeePaymentResponseDto> RejectAsync(int adminId, int paymentId, string reason);

        // Admin loại pairing chưa nộp phí để không còn nằm trong danh sách chờ.
        Task<AdminFeePairingDto> RejectUnpaidPairingAsync(
            int adminId, int pairingId, string reason);

        // Trả về (physicalPath, downloadFileName). Ném UnauthorizedAccessException
        // nếu actor không phải Owner của pairing và cũng không phải Admin.
        Task<(string PhysicalPath, string FileName)> GetProofAsync(
            int actorId, bool isAdmin, int paymentId);

        // Giải miễn phí: tạo payment Verified (Amount 0) + đưa Pairing lên Confirmed
        // trong cùng transaction. Trả về false nếu giải có thu phí (caller phải đi
        // đường nộp phí thường).
        Task<bool> TryAutoConfirmFreeAsync(int actorId, int pairingId);

        // Hangfire: quá PaymentDeadline mà chưa Confirmed -> Rejected. Idempotent.
        Task<int> RejectOverduePairingsAsync();
    }
}
