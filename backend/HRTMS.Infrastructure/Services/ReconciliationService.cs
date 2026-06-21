using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Reconciliation;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class ReconciliationService : IReconciliationService
{
    private readonly HRTMSDbContext _context;

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

    public async Task<ApiResponse<WalletDto>> GetMyWalletAsync(int spectatorId)
    {
        var wallet = await _context.Wallets
            .AsNoTracking()
            .Include(w => w.VirtualPointsTransactions)
            .FirstOrDefaultAsync(w => w.SpectatorId == spectatorId);

        if (wallet == null)
            return ApiResponse<WalletDto>.Fail("Không tìm thấy ví.");

        var dto = new WalletDto
        {
            WalletId = wallet.WalletId,
            Balance = wallet.Balance,
            Transactions = wallet.VirtualPointsTransactions
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => new TransactionDto
                {
                    TransactionId = t.TransactionId,
                    Amount = t.Amount,
                    Type = t.Type,
                    ReferenceId = t.ReferenceId,
                    CreatedAt = t.CreatedAt
                })
                .ToList()
        };

        return ApiResponse<WalletDto>.Ok(dto);
    }
}