using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Payment;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

// Module E/N — Nộp & đối chiếu lệ phí (patch 012).
//
// Đây là bước THAY THẾ cho PairingService.ConfirmAsync trong flow mới: Owner
// không tự bấm confirm cặp đấu nữa. Owner nộp lệ phí -> Pairing sang
// PendingVerification -> Admin verify -> Pairing sang Confirmed. Chỉ MỘT nơi
// đưa Pairing lên Confirmed để không có đường bypass thanh toán.
//
// Theo convention HRTMS: service ném exception với "error code" là message để
// Controller map sang HTTP status.
public class EntryFeePaymentService : IEntryFeePaymentService
{
    // Trạng thái payment còn "chiếm chỗ" — khớp filter của UQ_EFP_ActivePerPairing.
    private static readonly string[] ActivePaymentStatuses = { "PendingVerification", "Verified" };

    private readonly HRTMSDbContext _context;
    private readonly IFileStorageService _fileStorage;
    private readonly INotificationService _notification;
    private readonly IAuditLogService _audit;

    public EntryFeePaymentService(
        HRTMSDbContext context,
        IFileStorageService fileStorage,
        INotificationService notification,
        IAuditLogService audit)
    {
        _context = context;
        _fileStorage = fileStorage;
        _notification = notification;
        _audit = audit;
    }

    // =====================================================================
    // Owner nộp lệ phí
    // =====================================================================
    public async Task<FeePaymentResponseDto> SubmitAsync(
        int ownerId, int pairingId, SubmitFeePaymentDto dto, IFormFile? proofFile)
    {
        var pairing = await LoadPairingGraphAsync(pairingId)
            ?? throw new KeyNotFoundException("PAIRING_NOT_FOUND");

        // Chỉ chủ ngựa mới nộp phí cho cặp đấu của mình.
        if (pairing.Horse.OwnerId != ownerId)
            throw new UnauthorizedAccessException("FORBIDDEN");

        // Nộp phí là bước SAU khi jockey đã accept. 'PendingVerification' cũng được
        // phép: payment cũ đã bị reject, Owner nộp lại (pairing giữ nguyên trạng thái).
        if (pairing.Status is not ("Accepted" or "PendingVerification"))
            throw new InvalidOperationException("PAIRING_NOT_ACCEPTED");

        var tournament = pairing.Tournament;

        // Giải miễn phí không đi qua flow nộp phí — dùng TryAutoConfirmFreeAsync.
        if (tournament.EntryFeeAmount == 0)
            throw new InvalidOperationException("TOURNAMENT_IS_FREE");

        if (tournament.PaymentDeadline.HasValue && DateTime.UtcNow > tournament.PaymentDeadline.Value)
            throw new InvalidOperationException("PAYMENT_DEADLINE_PASSED");

        var method = dto.Method?.Trim() ?? string.Empty;
        if (method is not ("Cash" or "Transfer"))
            throw new InvalidOperationException("INVALID_PAYMENT_METHOD");

        // Mỗi phương thức có một mã đối chiếu bắt buộc — thiếu thì Admin không có
        // gì để verify.
        if (method == "Cash" && string.IsNullOrWhiteSpace(dto.ReceiptNo))
            throw new InvalidOperationException("RECEIPT_NO_REQUIRED");
        if (method == "Transfer" && string.IsNullOrWhiteSpace(dto.TransferRef))
            throw new InvalidOperationException("TRANSFER_REF_REQUIRED");

        // Chặn sớm ở tầng app; UQ_EFP_ActivePerPairing là chốt chặn cuối khi có
        // hai request nộp đồng thời.
        var hasActive = await _context.EntryFeePayments
            .AnyAsync(p => p.PairingId == pairingId && ActivePaymentStatuses.Contains(p.Status));
        if (hasActive)
            throw new InvalidOperationException("ACTIVE_PAYMENT_EXISTS");

        // Lưu file TRƯỚC transaction: nếu DB fail sau đó thì chỉ còn file mồ côi
        // (vô hại), còn nếu làm ngược lại thì có payment trỏ tới file không tồn tại.
        string? proofFileName = null;
        string? proofFilePath = null;
        if (proofFile != null && proofFile.Length > 0)
        {
            var saved = await _fileStorage.SaveFeeProofAsync(proofFile, pairingId);
            proofFilePath = saved.FilePath;
            proofFileName = saved.FileName;
        }

        var now = DateTime.UtcNow;
        var payment = new EntryFeePayment
        {
            PairingId = pairingId,
            Amount = tournament.EntryFeeAmount,
            Method = method,
            ReceiptNo = method == "Cash" ? dto.ReceiptNo!.Trim() : null,
            TransferRef = method == "Transfer" ? dto.TransferRef!.Trim() : null,
            ProofFileName = proofFileName,
            ProofFilePath = proofFilePath,
            Status = "PendingVerification",
            SubmittedAt = now
        };

        _context.EntryFeePayments.Add(payment);

        var oldPairingStatus = pairing.Status;
        pairing.Status = "PendingVerification";
        pairing.UpdatedAt = now;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (
            ex.InnerException is SqlException sqlEx &&
            (sqlEx.Number == 2601 || sqlEx.Number == 2627))
        {
            // Hai request nộp đồng thời -> UQ_EFP_ActivePerPairing chỉ cho một cái qua.
            throw new InvalidOperationException("ACTIVE_PAYMENT_EXISTS");
        }

        await _audit.LogAsync(ownerId, "Nộp lệ phí tham gia", "EntryFeePayment",
            payment.PaymentId.ToString(), oldPairingStatus,
            $"PendingVerification;Method={method};Amount={payment.Amount}");

        // Báo Admin có hồ sơ cần đối chiếu.
        var adminIds = await _context.Users
            .Where(u => u.Role == "Admin" && u.Status == "Active")
            .Select(u => u.UserId)
            .ToListAsync();
        if (adminIds.Count > 0)
        {
            await _notification.SendBulkAsync(adminIds,
                "Có lệ phí cần đối chiếu",
                $"Chủ ngựa đã nộp lệ phí cho ngựa '{pairing.Horse.Name}' ở giải '{tournament.Name}'. " +
                "Vui lòng đối chiếu chứng từ.",
                type: "In-app",
                relatedEntityType: "EntryFeePayment",
                relatedEntityId: payment.PaymentId);
        }

        return MapToDto(payment, pairing);
    }

    // =====================================================================
    // Admin: danh sách đối chiếu
    // =====================================================================
    public async Task<PagedResult<FeePaymentResponseDto>> GetForAdminAsync(
        string? status, int? tournamentId, int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 100) pageSize = 20;

        var query = _context.EntryFeePayments
            .Include(p => p.Pairing).ThenInclude(pr => pr.Horse).ThenInclude(h => h.Owner)
            .Include(p => p.Pairing).ThenInclude(pr => pr.Jockey).ThenInclude(j => j.Jockey)
            .Include(p => p.Pairing).ThenInclude(pr => pr.Tournament)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);

        if (tournamentId.HasValue)
            query = query.Where(p => p.Pairing.TournamentId == tournamentId.Value);

        var total = await query.CountAsync();

        // Hồ sơ nộp sớm được đối chiếu trước — cùng thứ tự ưu tiên với auto-allocate.
        var items = await query
            .OrderBy(p => p.SubmittedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<FeePaymentResponseDto>
        {
            Items = items.Select(p => MapToDto(p, p.Pairing)).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }

    // =====================================================================
    // Admin verify -> Pairing Confirmed
    // =====================================================================
    public async Task<FeePaymentResponseDto> VerifyAsync(int adminId, int paymentId)
    {
        var payment = await _context.EntryFeePayments
            .FirstOrDefaultAsync(p => p.PaymentId == paymentId)
            ?? throw new KeyNotFoundException("PAYMENT_NOT_FOUND");

        if (payment.Status == "Verified")
            throw new InvalidOperationException("PAYMENT_ALREADY_VERIFIED");
        if (payment.Status != "PendingVerification")
            throw new InvalidOperationException("PAYMENT_NOT_PENDING");

        var pairing = await LoadPairingGraphAsync(payment.PairingId)
            ?? throw new KeyNotFoundException("PAIRING_NOT_FOUND");

        var now = DateTime.UtcNow;
        var oldPairingStatus = pairing.Status;

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // Guard nguyên tử: chỉ flip khi payment vẫn PendingVerification.
            // ExecuteUpdate trả về rowcount -> chặn hai Admin verify song song.
            var rows = await _context.EntryFeePayments
                .Where(p => p.PaymentId == paymentId && p.Status == "PendingVerification")
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Status, "Verified")
                    .SetProperty(p => p.VerifiedBy, adminId)
                    .SetProperty(p => p.VerifiedAt, now));

            if (rows == 0)
                throw new InvalidOperationException("PAYMENT_NOT_PENDING");

            await ConfirmPairingAndCancelRivalsAsync(pairing, now);

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        // Refresh entity trong bộ nhớ để DTO trả về đúng (ExecuteUpdate không
        // cập nhật entity đang track).
        payment.Status = "Verified";
        payment.VerifiedBy = adminId;
        payment.VerifiedAt = now;

        await _audit.LogAsync(adminId, "Xác nhận lệ phí tham gia", "EntryFeePayment",
            paymentId.ToString(), oldPairingStatus, $"Verified;PairingId={pairing.PairingId}");

        await _notification.SendAsync(pairing.Horse.OwnerId,
            "Lệ phí đã được xác nhận",
            $"Lệ phí cho ngựa '{pairing.Horse.Name}' ở giải '{pairing.Tournament.Name}' đã được xác nhận. " +
            "Cặp đấu của bạn đã đủ điều kiện tham gia.",
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairing.PairingId);

        await _notification.SendAsync(pairing.JockeyId,
            "Lệ phí đã được xác nhận",
            $"Cặp đấu với ngựa '{pairing.Horse.Name}' ở giải '{pairing.Tournament.Name}' đã đủ điều kiện tham gia.",
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairing.PairingId);

        return MapToDto(payment, pairing);
    }

    // =====================================================================
    // Admin reject -> Owner nộp lại được
    // =====================================================================
    public async Task<FeePaymentResponseDto> RejectAsync(int adminId, int paymentId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 10)
            throw new InvalidOperationException("REJECT_REASON_REQUIRED");

        var payment = await _context.EntryFeePayments
            .FirstOrDefaultAsync(p => p.PaymentId == paymentId)
            ?? throw new KeyNotFoundException("PAYMENT_NOT_FOUND");

        if (payment.Status != "PendingVerification")
            throw new InvalidOperationException("PAYMENT_NOT_PENDING");

        var pairing = await LoadPairingGraphAsync(payment.PairingId)
            ?? throw new KeyNotFoundException("PAIRING_NOT_FOUND");

        var now = DateTime.UtcNow;
        var trimmedReason = reason.Trim();

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var rows = await _context.EntryFeePayments
                .Where(p => p.PaymentId == paymentId && p.Status == "PendingVerification")
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Status, "Rejected")
                    .SetProperty(p => p.VerifiedBy, adminId)
                    .SetProperty(p => p.VerifiedAt, now)
                    .SetProperty(p => p.RejectReason, trimmedReason));

            if (rows == 0)
                throw new InvalidOperationException("PAYMENT_NOT_PENDING");

            // Pairing quay lại 'Accepted' — Owner nộp lại được trước deadline.
            // Payment vừa chuyển Rejected nên KHÔNG còn nằm trong filter của
            // UQ_EFP_ActivePerPairing: lần nộp sau không bị unique chặn.
            await _context.Pairings
                .Where(p => p.PairingId == pairing.PairingId && p.Status == "PendingVerification")
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Status, "Accepted")
                    .SetProperty(p => p.UpdatedAt, now));

            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        payment.Status = "Rejected";
        payment.VerifiedBy = adminId;
        payment.VerifiedAt = now;
        payment.RejectReason = trimmedReason;
        pairing.Status = "Accepted";

        await _audit.LogAsync(adminId, "Từ chối lệ phí tham gia", "EntryFeePayment",
            paymentId.ToString(), "PendingVerification", $"Rejected;Reason={trimmedReason}");

        var deadlineNote = pairing.Tournament.PaymentDeadline.HasValue
            ? $" Hạn nộp lại: {pairing.Tournament.PaymentDeadline.Value:dd/MM/yyyy HH:mm} (giờ UTC)."
            : string.Empty;

        await _notification.SendAsync(pairing.Horse.OwnerId,
            "Lệ phí bị từ chối",
            $"Lệ phí cho ngựa '{pairing.Horse.Name}' ở giải '{pairing.Tournament.Name}' đã bị từ chối. " +
            $"Lý do: {trimmedReason}. Vui lòng nộp lại." + deadlineNote,
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairing.PairingId);

        return MapToDto(payment, pairing);
    }

    // =====================================================================
    // Tải chứng từ — chỉ Owner của pairing hoặc Admin
    // =====================================================================
    public async Task<(string PhysicalPath, string FileName)> GetProofAsync(
        int actorId, bool isAdmin, int paymentId)
    {
        var payment = await _context.EntryFeePayments
            .Include(p => p.Pairing).ThenInclude(pr => pr.Horse)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.PaymentId == paymentId)
            ?? throw new KeyNotFoundException("PAYMENT_NOT_FOUND");

        // Chốt chặn quan trọng: Owner khác KHÔNG được xem chứng từ của pairing
        // không phải của mình.
        if (!isAdmin && payment.Pairing.Horse.OwnerId != actorId)
            throw new UnauthorizedAccessException("FORBIDDEN");

        if (string.IsNullOrWhiteSpace(payment.ProofFilePath))
            throw new KeyNotFoundException("PROOF_NOT_FOUND");

        var physicalPath = _fileStorage.ResolveFeeProofPhysicalPath(payment.ProofFilePath)
            ?? throw new KeyNotFoundException("PROOF_NOT_FOUND");

        return (physicalPath, payment.ProofFileName ?? Path.GetFileName(physicalPath));
    }

    // =====================================================================
    // Giải miễn phí: auto Verified + Pairing Confirmed
    // =====================================================================
    public async Task<bool> TryAutoConfirmFreeAsync(int actorId, int pairingId)
    {
        var pairing = await LoadPairingGraphAsync(pairingId)
            ?? throw new KeyNotFoundException("PAIRING_NOT_FOUND");

        // Giải có thu phí -> caller phải đi đường nộp phí thường.
        if (pairing.Tournament.EntryFeeAmount != 0)
            return false;

        if (pairing.Status == "Confirmed")
            return true;

        if (pairing.Status is not ("Accepted" or "PendingVerification"))
            throw new InvalidOperationException("PAIRING_NOT_ACCEPTED");

        var now = DateTime.UtcNow;

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // Vẫn ghi một payment (Amount = 0, Verified) để giữ MỘT nguồn sự thật:
            // "Pairing Confirmed <=> có payment Verified". Auto-allocate chỉ cần
            // kiểm tra một điều kiện, không phải rẽ nhánh theo giải free/có phí.
            var hasActive = await _context.EntryFeePayments
                .AnyAsync(p => p.PairingId == pairingId && ActivePaymentStatuses.Contains(p.Status));

            if (!hasActive)
            {
                _context.EntryFeePayments.Add(new EntryFeePayment
                {
                    PairingId = pairingId,
                    Amount = 0,
                    Method = "Cash",
                    ReceiptNo = "FREE-ENTRY",
                    Status = "Verified",
                    SubmittedAt = now,
                    VerifiedBy = actorId,
                    VerifiedAt = now
                });
            }

            await ConfirmPairingAndCancelRivalsAsync(pairing, now);

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        await _audit.LogAsync(actorId, "Tự động xác nhận cặp đấu (giải miễn phí)", "Pairing",
            pairingId.ToString(), "Accepted", "Confirmed");

        await _notification.SendAsync(pairing.JockeyId,
            "Cặp thi đấu đã được xác nhận",
            $"Cặp đấu với ngựa '{pairing.Horse.Name}' đã được xác nhận (giải miễn lệ phí).",
            type: "Both",
            relatedEntityType: "Pairing",
            relatedEntityId: pairingId);

        return true;
    }

    // =====================================================================
    // Hangfire: quá hạn nộp phí -> Rejected
    // =====================================================================
    public async Task<int> RejectOverduePairingsAsync()
    {
        var now = DateTime.UtcNow;

        // Chỉ giải ĐANG nhận đăng ký và ĐÃ đặt hạn. Pairing đã Confirmed không bị
        // đụng tới; giải miễn phí về nguyên tắc đã Confirmed ngay khi accept nên
        // cũng không lọt vào đây.
        var overduePairingIds = await _context.Pairings
            .Where(p => p.Tournament.PaymentDeadline != null &&
                        p.Tournament.PaymentDeadline < now &&
                        (p.Tournament.Status == "Open Registration" ||
                         p.Tournament.Status == "Closed Registration") &&
                        (p.Status == "Pending" || p.Status == "Accepted" ||
                         p.Status == "PendingVerification"))
            .Select(p => p.PairingId)
            .ToListAsync();

        if (overduePairingIds.Count == 0)
            return 0;

        var systemActorId = await _context.Users
            .Where(u => u.Role == "System" && u.Status == "Active")
            .Select(u => u.UserId)
            .FirstOrDefaultAsync();
        if (systemActorId == 0)
            throw new InvalidOperationException("SYSTEM_USER_NOT_FOUND");

        var affected = 0;
        foreach (var pairingId in overduePairingIds)
        {
            // Guard nguyên tử từng pairing: chạy lại job không đổi gì thêm
            // (Declined không nằm trong tập điều kiện) -> idempotent.
            var rows = await _context.Pairings
                .Where(p => p.PairingId == pairingId &&
                            (p.Status == "Pending" || p.Status == "Accepted" ||
                             p.Status == "PendingVerification"))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Status, "Declined")
                    .SetProperty(p => p.ResponseReason,
                        "Chưa hoàn tất lệ phí trước thời hạn nên không thể tham gia giải đấu.")
                    .SetProperty(p => p.UpdatedAt, now));

            if (rows == 0) continue;
            affected++;

            // Payment còn treo cũng phải đóng lại, nếu không nó vẫn chiếm chỗ
            // trong UQ_EFP_ActivePerPairing.
            await _context.EntryFeePayments
                .Where(p => p.PairingId == pairingId && p.Status == "PendingVerification")
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Status, "Rejected")
                    .SetProperty(p => p.VerifiedAt, now)
                    .SetProperty(p => p.RejectReason, "Quá hạn nộp lệ phí."));

            var info = await _context.Pairings
                .Where(p => p.PairingId == pairingId)
                .Select(p => new { p.Horse.OwnerId, HorseName = p.Horse.Name, p.JockeyId })
                .FirstAsync();

            await _notification.SendBulkAsync(
                new[] { info.OwnerId, info.JockeyId },
                "Chưa hoàn tất lệ phí",
                $"Cặp đấu với ngựa '{info.HorseName}' chưa hoàn tất lệ phí trước thời hạn " +
                "nên không thể tham gia giải đấu.",
                type: "Both",
                relatedEntityType: "Pairing",
                relatedEntityId: pairingId);

            await _audit.LogAsync(systemActorId, "Tự động từ chối cặp đấu (quá hạn lệ phí)",
                "Pairing", pairingId.ToString(), null, "Declined");
        }

        return affected;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private Task<Pairing?> LoadPairingGraphAsync(int pairingId) =>
        _context.Pairings
            .Include(p => p.Horse).ThenInclude(h => h.Owner)
            .Include(p => p.Jockey).ThenInclude(j => j.Jockey)
            .Include(p => p.Tournament)
            .FirstOrDefaultAsync(p => p.PairingId == pairingId);

    // Đưa Pairing lên Confirmed và hủy các lời mời còn treo của CÙNG con ngựa
    // trong cùng giải — giữ nguyên hành vi của PairingService.ConfirmAsync cũ.
    // Không gọi SaveChanges: caller quyết định ranh giới transaction.
    private async Task ConfirmPairingAndCancelRivalsAsync(Pairing pairing, DateTime now)
    {
        pairing.Status = "Confirmed";
        pairing.UpdatedAt = now;

        var rivals = await _context.Pairings
            .Where(p => p.TournamentId == pairing.TournamentId &&
                        p.HorseId == pairing.HorseId &&
                        p.PairingId != pairing.PairingId &&
                        (p.Status == "Pending" || p.Status == "Accepted" ||
                         p.Status == "PendingVerification"))
            .ToListAsync();

        foreach (var rival in rivals)
        {
            rival.Status = "Cancelled";
            rival.ResponseReason = "Chủ ngựa đã xác nhận một cặp đấu khác cho ngựa này.";
            rival.UpdatedAt = now;
        }
    }

    private static FeePaymentResponseDto MapToDto(EntryFeePayment p, Pairing pairing) => new()
    {
        PaymentId = p.PaymentId,
        PairingId = p.PairingId,
        TournamentId = pairing.TournamentId,
        TournamentName = pairing.Tournament?.Name ?? string.Empty,
        HorseId = pairing.HorseId,
        HorseName = pairing.Horse?.Name ?? string.Empty,
        JockeyId = pairing.JockeyId,
        JockeyName = pairing.Jockey?.Jockey?.FullName ?? string.Empty,
        OwnerId = pairing.Horse?.OwnerId ?? 0,
        OwnerName = pairing.Horse?.Owner?.Owner?.FullName ?? string.Empty,
        Amount = p.Amount,
        Method = p.Method,
        ReceiptNo = p.ReceiptNo,
        TransferRef = p.TransferRef,
        ProofFileName = p.ProofFileName,
        HasProof = !string.IsNullOrWhiteSpace(p.ProofFilePath),
        Status = p.Status,
        SubmittedAt = p.SubmittedAt,
        VerifiedBy = p.VerifiedBy,
        VerifiedAt = p.VerifiedAt,
        RejectReason = p.RejectReason,
        PairingStatus = pairing.Status
    };
}
