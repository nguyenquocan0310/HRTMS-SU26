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
    private const int MaxBatchQuantity = 1000;

    // Bộ ký tự Crockford base32 (bỏ I/L/O/U để tránh nhầm khi đọc/gõ mã).
    private const string CodeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    private const int CodeBodyLength = 12;

    public WalletService(HRTMSDbContext context, IAuditLogService auditLog)
    {
        _context = context;
        _auditLog = auditLog;
    }

    public async Task<ApiResponse<RedeemTicketCodeResponseDto>> RedeemTicketCodeAsync(
        int spectatorId, RedeemTicketCodeDto dto, string? ipAddress)
    {
        // ACC.1.2: Spectator đăng ký tối giản, nhưng khi redeem ticket code (nhận
        // reward) phải bổ sung đủ phone + CCCD. Đọc từ Users (spectatorId lấy từ JWT
        // claim ở controller, không tin request param) — cùng pattern check identity
        // với TournamentParticipantService (Module A của Hào chưa có helper riêng;
        // khi có IIdentityCompletenessChecker thì thay đoạn này bằng helper đó).
        var identityComplete = await _context.Users.AnyAsync(u =>
            u.UserId == spectatorId &&
            u.PhoneNumber != null &&
            u.IdentityHash != null);
        if (!identityComplete)
            return ApiResponse<RedeemTicketCodeResponseDto>.Fail(
                "Bạn cần bổ sung số điện thoại và số CCCD trong hồ sơ trước khi đổi mã vé thưởng.");

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

    public async Task<ApiResponse<CreateTicketCodesResponseDto>> CreateTicketCodesAsync(
        int adminId, CreateTicketCodesDto dto, string? ipAddress)
    {
        if (dto.Quantity < 1 || dto.Quantity > MaxBatchQuantity)
            return ApiResponse<CreateTicketCodesResponseDto>.Fail(
                $"Số lượng mã phải từ 1 đến {MaxBatchQuantity}.");

        if (dto.RewardAmount <= 0)
            return ApiResponse<CreateTicketCodesResponseDto>.Fail("Điểm thưởng phải lớn hơn 0.");

        var now = DateTime.UtcNow;
        if (dto.ExpiresAt <= now)
            return ApiResponse<CreateTicketCodesResponseDto>.Fail("Thời điểm hết hạn phải ở tương lai.");

        // Sinh raw code duy nhất trong batch (secure RNG). HashSet chặn trùng trong batch.
        var rawCodes = new List<string>(dto.Quantity);
        var seen = new HashSet<string>();
        while (seen.Count < dto.Quantity)
        {
            var code = GenerateRawCode();
            if (seen.Add(code)) rawCodes.Add(code);
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            foreach (var raw in rawCodes)
            {
                _context.TicketRewardCodes.Add(new TicketRewardCode
                {
                    CodeHash = HashCode(raw),   // chỉ lưu hash, không lưu raw code
                    PointAmount = dto.RewardAmount,
                    Status = StatusActive,
                    ExpiresAt = dto.ExpiresAt,
                    CreatedAt = now
                });
            }

            // UNIQUE(CodeHash) chặn trùng với code đã tồn tại; vi phạm → DbUpdateException → rollback cả batch.
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        // Audit: KHÔNG ghi raw code, chỉ ghi metadata batch.
        await _auditLog.LogAsync(
            actorId: adminId,
            action: "CreateTicketCodes",
            entityName: "TicketRewardCode",
            entityId: "batch",
            newValue: $"count={dto.Quantity};reward={dto.RewardAmount};expiresAt={dto.ExpiresAt:o}",
            ipAddress: ipAddress);

        return ApiResponse<CreateTicketCodesResponseDto>.Ok(new CreateTicketCodesResponseDto
        {
            Count = rawCodes.Count,
            RewardAmount = dto.RewardAmount,
            ExpiresAt = dto.ExpiresAt,
            Codes = rawCodes   // raw code trả về ĐÚNG MỘT LẦN tại đây
        });
    }

    /// <summary>Sinh raw code dạng TKT-XXXXXXXXXXXX bằng RNG mật mã (khó đoán).</summary>
    private static string GenerateRawCode()
    {
        var chars = new char[CodeBodyLength];
        Span<byte> bytes = stackalloc byte[CodeBodyLength];
        RandomNumberGenerator.Fill(bytes);
        for (int i = 0; i < CodeBodyLength; i++)
            chars[i] = CodeAlphabet[bytes[i] % CodeAlphabet.Length];
        return $"TKT-{new string(chars)}";
    }

    private static byte[] HashCode(string rawCode)
        => SHA256.HashData(Encoding.UTF8.GetBytes(rawCode.Trim()));
}
