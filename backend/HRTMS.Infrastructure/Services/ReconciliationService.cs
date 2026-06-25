using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Reconciliation;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class ReconciliationService : IReconciliationService
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLog;   // FIX #6: inject AuditLog

    private const int DefaultPageSize = 50;

    public ReconciliationService(HRTMSDbContext context, IAuditLogService auditLog)
    {
        _context = context;
        _auditLog = auditLog;
    }

    public async Task<ApiResponse<List<PredictionHistoryDto>>> GetMyPredictionsAsync(int spectatorId)
    {
        var predictions = await _context.Predictions
            .AsNoTracking()
            .Where(p => p.SpectatorId == spectatorId)
            .Include(p => p.RaceEntry)
                .ThenInclude(re => re.Pairing)
                    .ThenInclude(pa => pa.Horse)
            .Include(p => p.Race)
                .ThenInclude(r => r.Round)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PredictionHistoryDto
            {
                PredictionId = p.PredictionId,
                RaceId = p.RaceId,
                RaceName = $"{p.Race.Round.Name} - Race #{p.Race.RaceNumber}",
                HorseName = p.RaceEntry.Pairing.Horse.Name,
                PredictionType = p.PredictionType,
                PointsPlaced = p.PointsPlaced,
                Status = p.Status,
                PointsAwarded = p.PointsAwarded,
                CreatedAt = p.CreatedAt
            })
            .ToListAsync();

        return ApiResponse<List<PredictionHistoryDto>>.Ok(predictions);
    }

    // FIX #5: Chỉ load 50 giao dịch gần nhất thay vì Include toàn bộ collection.
    public async Task<ApiResponse<WalletDto>> GetMyWalletAsync(int spectatorId)
    {
        var wallet = await _context.Wallets
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.SpectatorId == spectatorId);

        if (wallet == null)
            return ApiResponse<WalletDto>.Fail("Không tìm thấy ví.");

        var totalTransactions = await _context.VirtualPointsTransactions
            .CountAsync(t => t.WalletId == wallet.WalletId);

        var recentTransactions = await _context.VirtualPointsTransactions
            .AsNoTracking()
            .Where(t => t.WalletId == wallet.WalletId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(DefaultPageSize)
            .Select(t => new TransactionDto
            {
                TransactionId = t.TransactionId,
                Amount = t.Amount,
                Type = t.Type,
                ReferenceId = t.ReferenceId,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        var dto = new WalletDto
        {
            WalletId = wallet.WalletId,
            Balance = wallet.Balance,
            Transactions = recentTransactions,
            TotalTransactions = totalTransactions
        };

        return ApiResponse<WalletDto>.Ok(dto);
    }

    // FIX #5: Endpoint phân trang riêng cho lịch sử giao dịch
    public async Task<ApiResponse<PagedResult<TransactionDto>>> GetMyTransactionsAsync(
        int spectatorId, int page, int pageSize)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = DefaultPageSize;

        var walletId = await _context.Wallets
            .Where(w => w.SpectatorId == spectatorId)
            .Select(w => w.WalletId)
            .FirstOrDefaultAsync();

        if (walletId == 0)
            return ApiResponse<PagedResult<TransactionDto>>.Fail("Không tìm thấy ví.");

        var total = await _context.VirtualPointsTransactions
            .CountAsync(t => t.WalletId == walletId);

        var items = await _context.VirtualPointsTransactions
            .AsNoTracking()
            .Where(t => t.WalletId == walletId)
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TransactionDto
            {
                TransactionId = t.TransactionId,
                Amount = t.Amount,
                Type = t.Type,
                ReferenceId = t.ReferenceId,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        var paged = new PagedResult<TransactionDto>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };

        return ApiResponse<PagedResult<TransactionDto>>.Ok(paged);
    }
}