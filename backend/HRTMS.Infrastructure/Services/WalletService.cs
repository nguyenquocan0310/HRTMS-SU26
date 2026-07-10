using System.Security.Cryptography;
using System.Text;
using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Wallet;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class WalletService : IWalletService
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLog;

    private const string StatusActive = "Active";
    private const string StatusRedeemed = "Redeemed";
    private const string TxnTypeTicketCodeBonus = "Ticket Code Bonus";
    private const string RefTypeTicketRewardCode = "TicketRewardCode";

    public WalletService(HRTMSDbContext context, IAuditLogService auditLog)
    {
        _context = context;
        _auditLog = auditLog;
    }

    public async Task<ApiResponse<RedeemTicketCodeResponseDto>> RedeemTicketCodeAsync(
        int spectatorId, RedeemTicketCodeDto dto, string? ipAddress)
    {
        var codeHash = HashCode(dto.Code);
        var now = DateTime.UtcNow;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Tra cứu code theo hash (không tin tưởng mã thô).
            var code = await _context.TicketRewardCodes
                .FirstOrDefaultAsync(c => c.CodeHash == codeHash);

            if (code == null)
                return ApiResponse<RedeemTicketCodeResponseDto>.Fail("Mã vé thưởng không tồn tại.");

            if (code.Status != StatusActive)
                return ApiResponse<RedeemTicketCodeResponseDto>.Fail(
                    code.Status == StatusRedeemed
                        ? "Mã vé thưởng đã được sử dụng."
                        : "Mã vé thưởng không còn hiệu lực.");

            if (code.ExpiresAt <= now)
                return ApiResponse<RedeemTicketCodeResponseDto>.Fail("Mã vé thưởng đã hết hạn.");

            // Claim nguyên tử: chỉ redeem được nếu code VẪN đang Active và chưa hết hạn.
            // Nếu một request khác đã redeem trước (kể cả đồng thời), affected = 0 → abort,
            // đảm bảo một code không bao giờ được cộng điểm hai lần.
            var claimed = await _context.TicketRewardCodes
                .Where(c => c.TicketRewardCodeId == code.TicketRewardCodeId
                            && c.Status == StatusActive
                            && c.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.Status, StatusRedeemed)
                    .SetProperty(c => c.RedeemedBySpectatorId, spectatorId)
                    .SetProperty(c => c.RedeemedAt, now));

            if (claimed == 0)
                return ApiResponse<RedeemTicketCodeResponseDto>.Fail("Mã vé thưởng đã được sử dụng.");

            // Cộng điểm vào ví (Spectator 1:1 Wallet). Giữ bất biến Balance = SUM(VPT).
            var credited = await _context.Wallets
                .Where(w => w.SpectatorId == spectatorId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(w => w.Balance, w => w.Balance + code.PointAmount)
                    .SetProperty(w => w.UpdatedAt, now));

            if (credited == 0)
                // Không tìm thấy ví → rollback (không để code bị đánh dấu Redeemed mà không cộng điểm).
                return ApiResponse<RedeemTicketCodeResponseDto>.Fail("Không tìm thấy ví của người dùng.");

            var wallet = await _context.Wallets
                .AsNoTracking()
                .FirstAsync(w => w.SpectatorId == spectatorId);

            _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
            {
                WalletId = wallet.WalletId,
                Amount = code.PointAmount,
                Type = TxnTypeTicketCodeBonus,
                ReferenceType = RefTypeTicketRewardCode,
                ReferenceId = code.TicketRewardCodeId.ToString(),
                CreatedAt = now
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            await _auditLog.LogAsync(
                actorId: spectatorId,
                action: "RedeemTicketCode",
                entityName: "TicketRewardCode",
                entityId: code.TicketRewardCodeId.ToString(),
                newValue: $"+{code.PointAmount}",
                ipAddress: ipAddress);

            return ApiResponse<RedeemTicketCodeResponseDto>.Ok(new RedeemTicketCodeResponseDto
            {
                PointsAdded = code.PointAmount,
                NewBalance = wallet.Balance
            });
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private static byte[] HashCode(string rawCode)
        => SHA256.HashData(Encoding.UTF8.GetBytes(rawCode.Trim()));
}
