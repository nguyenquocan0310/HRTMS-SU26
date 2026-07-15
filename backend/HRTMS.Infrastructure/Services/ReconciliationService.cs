using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Reconciliation;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class ReconciliationService : IReconciliationService
{
    private readonly HRTMSDbContext _context;

    private const int DefaultPageSize = 50;

    public ReconciliationService(HRTMSDbContext context)
    {
        _context = context;
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
            .Select(p => new
            {
                p.PredictionId,
                p.RaceId,
                RaceName = $"{p.Race.Round.Name} - Race #{p.Race.RaceNumber}",
                HorseName = p.RaceEntry.Pairing.Horse.Name,
                p.PredictionType,
                p.PointsPlaced,
                p.Status,
                p.PointsAwarded,
                RaceStatus = p.Race.Status,
                ActualFinishPosition = p.RaceEntry.FinishPosition,
                p.CreatedAt
            })
            .ToListAsync();

        // REQ-F-REC.3 — nạp tên (các) ngựa về Nhất chính thức cho từng race liên quan,
        // gom 1 query thay vì N+1 (mỗi race đối chiếu có thể lặp lại giữa nhiều dự đoán).
        var raceIds = predictions.Select(p => p.RaceId).Distinct().ToList();
        var winnersByRace = await _context.RaceEntries
            .AsNoTracking()
            .Where(re => raceIds.Contains(re.RaceId)
                         && re.FinishPosition == 1
                         && re.Status != "Cancelled" && re.Status != "Disqualified")
            .Select(re => new { re.RaceId, HorseName = re.Pairing.Horse.Name })
            .ToListAsync();

        var winningNamesByRace = winnersByRace
            .GroupBy(w => w.RaceId)
            .ToDictionary(g => g.Key, g => string.Join(", ", g.Select(w => w.HorseName)));

        var result = predictions.Select(p => new PredictionHistoryDto
        {
            PredictionId = p.PredictionId,
            RaceId = p.RaceId,
            RaceName = p.RaceName,
            HorseName = p.HorseName,
            PredictionType = p.PredictionType,
            PointsPlaced = p.PointsPlaced,
            Status = p.Status,
            PointsAwarded = p.PointsAwarded,
            // Chỉ hiển thị kết quả thực tế khi race đã Official — tránh lộ
            // thứ hạng tạm/chưa chính thức cho Spectator trước khi công bố.
            ActualFinishPosition = p.RaceStatus == "Official" ? p.ActualFinishPosition : null,
            WinningHorseName = p.RaceStatus == "Official"
                ? winningNamesByRace.GetValueOrDefault(p.RaceId)
                : null,
            CreatedAt = p.CreatedAt
        }).ToList();

        return ApiResponse<List<PredictionHistoryDto>>.Ok(result);
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