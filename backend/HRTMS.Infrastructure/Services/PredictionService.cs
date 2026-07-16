using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Prediction;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class PredictionService : IPredictionService
{
    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLog;
    private readonly INotificationService _notificationService;

    private const string PredictionTypeWin = "Win";
    // Cổng dự đoán chỉ mở sau khi Referee chốt official starting list (Pre-Race)
    // và tự đóng khi race chuyển sang Live.
    private const string RaceStatusPreRace = "Pre-Race";
    private const string TxnTypePredictionPlaced = "Prediction Placed";

    public PredictionService(
        HRTMSDbContext context,
        IAuditLogService auditLog,
        INotificationService notificationService)
    {
        _context = context;
        _auditLog = auditLog;
        _notificationService = notificationService;
    }

    // =========================================================
    // Admin cấu hình / đóng-mở cổng dự đoán
    // Cổng chỉ mở sau Post Position Draw
    // =========================================================
    public async Task<ApiResponse<bool>> SetPredictionGateAsync(
        int raceId, PredictionGateConfigDto dto, int adminId, string? ipAddress)
    {
        var race = await _context.Races.FirstOrDefaultAsync(r => r.RaceId == raceId);
        if (race == null)
            return ApiResponse<bool>.Fail("Không tìm thấy cuộc đua.");

        // StartingListService tự mở cổng khi chuyển sang Pre-Race. Admin chỉ được
        // mở lại trong cùng phase này, không thể mở khi danh sách chưa chốt.
        if (!dto.IsPredictionGateClosed && race.Status != RaceStatusPreRace)
            return ApiResponse<bool>.Fail("Chỉ có thể mở cổng dự đoán sau khi Referee chốt danh sách xuất phát.");

        race.IsPredictionGateClosed = dto.IsPredictionGateClosed;
        race.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: adminId,
            action: dto.IsPredictionGateClosed ? "ClosePredictionGate" : "OpenPredictionGate",
            entityName: "Races",
            entityId: race.RaceId.ToString(),
            ipAddress: ipAddress
        );

        return ApiResponse<bool>.Ok(true, dto.IsPredictionGateClosed
            ? "Đã đóng cổng dự đoán."
            : "Đã mở cổng dự đoán.");
    }

    public async Task<ApiResponse<PredictionGateStatusDto>> GetGateStatusAsync(int raceId)
    {
        var race = await _context.Races.AsNoTracking()
            .FirstOrDefaultAsync(r => r.RaceId == raceId);

        if (race == null)
            return ApiResponse<PredictionGateStatusDto>.Fail("Không tìm thấy cuộc đua.");

        var status = new PredictionGateStatusDto
        {
            RaceId = race.RaceId,
            IsPostPositionDrawn = race.IsPostPositionDrawn,
            IsPredictionGateClosed = race.IsPredictionGateClosed,
            RaceStatus = race.Status,
            CanPredict = race.IsPostPositionDrawn
                         && !race.IsPredictionGateClosed
                         && race.Status == RaceStatusPreRace
        };

        return ApiResponse<PredictionGateStatusDto>.Ok(status);
    }

    // =========================================================
    // Form Score: 40% lịch sử ngựa + 35% lịch sử Jockey
    // + 25% kết quả trung bình theo loại vòng đua. Tính server-side.
    //
    // FIX #1: Tải toàn bộ lịch sử 1 lần trước vòng lặp (loại bỏ N+1 query).
    // =========================================================
    public async Task<ApiResponse<List<FormScoreDto>>> GetFormScoresAsync(int raceId)
    {
        var race = await _context.Races.AsNoTracking()
            .Include(r => r.Round)
            .FirstOrDefaultAsync(r => r.RaceId == raceId);
        if (race == null)
            return ApiResponse<List<FormScoreDto>>.Fail("Không tìm thấy cuộc đua.");

        var entries = await _context.RaceEntries
            .AsNoTracking()
            .Where(re => re.RaceId == raceId && !re.IsWithdrawn)
            .Include(re => re.Pairing)
                .ThenInclude(p => p.Horse)
            .Include(re => re.Pairing)
                .ThenInclude(p => p.Jockey)
                    .ThenInclude(jp => jp.Jockey)
            .ToListAsync();

        if (entries.Count == 0)
            return ApiResponse<List<FormScoreDto>>.Ok(new List<FormScoreDto>());

        var horseIds = entries.Select(e => e.Pairing.HorseId).ToHashSet();
        var jockeyIds = entries.Select(e => e.Pairing.JockeyId).ToHashSet();
        var roundName = race.Round.Name;

        // --- Load toàn bộ lịch sử 1 lần, tránh N+1 ---

        // 40% — lịch sử ngựa: tất cả race entries đã hoàn tất của các ngựa liên quan
        var horseHistory = await _context.RaceEntries
            .AsNoTracking()
            .Where(re => horseIds.Contains(re.Pairing.HorseId) && re.FinishPosition != null)
            .Select(re => new { re.Pairing.HorseId, re.FinishPosition })
            .ToListAsync();

        // 35% — lịch sử Jockey: tương tự
        var jockeyHistory = await _context.RaceEntries
            .AsNoTracking()
            .Where(re => jockeyIds.Contains(re.Pairing.JockeyId) && re.FinishPosition != null)
            .Select(re => new { re.Pairing.JockeyId, re.FinishPosition })
            .ToListAsync();

        // 25% — kết quả theo loại vòng đua (Round.Name) cho các ngựa liên quan
        var roundHistory = await _context.RaceEntries
            .AsNoTracking()
            .Where(re => horseIds.Contains(re.Pairing.HorseId)
                         && re.FinishPosition != null
                         && re.Race.Round.Name == roundName)
            .Select(re => new { re.Pairing.HorseId, re.FinishPosition })
            .ToListAsync();

        // Group theo key để tra cứu O(1)
        var horseHistoryByHorse = horseHistory.GroupBy(x => x.HorseId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.FinishPosition!.Value).ToList());

        var jockeyHistoryByJockey = jockeyHistory.GroupBy(x => x.JockeyId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.FinishPosition!.Value).ToList());

        var roundHistoryByHorse = roundHistory.GroupBy(x => x.HorseId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.FinishPosition!.Value).ToList());

        // --- Tính FormScore trong memory ---
        var result = new List<FormScoreDto>(entries.Count);

        foreach (var entry in entries)
        {
            var horseId = entry.Pairing.HorseId;
            var jockeyId = entry.Pairing.JockeyId;

            // 40% — tỉ lệ về Top-1 của ngựa
            var horseFinished = horseHistoryByHorse.GetValueOrDefault(horseId);
            decimal horseScore = horseFinished == null || horseFinished.Count == 0
                ? 0
                : (decimal)horseFinished.Count(p => p == 1) / horseFinished.Count * 100m;

            // 35% — tỉ lệ về Top-1 của Jockey
            var jockeyFinished = jockeyHistoryByJockey.GetValueOrDefault(jockeyId);
            decimal jockeyScore = jockeyFinished == null || jockeyFinished.Count == 0
                ? 0
                : (decimal)jockeyFinished.Count(p => p == 1) / jockeyFinished.Count * 100m;

            // 25% — vị trí trung bình theo loại vòng (điểm cao hơn nếu vị trí trung bình gần 1)
            var roundFinished = roundHistoryByHorse.GetValueOrDefault(horseId);
            decimal roundTypeAvgScore = roundFinished == null || roundFinished.Count == 0
                ? 0
                : 100m - ((decimal)roundFinished.Average() - 1m) * 10m;
            roundTypeAvgScore = Math.Max(0, roundTypeAvgScore);

            var formScore = horseScore * 0.40m + jockeyScore * 0.35m + roundTypeAvgScore * 0.25m;

            result.Add(new FormScoreDto
            {
                RaceEntryId = entry.RaceEntryId,
                HorseId = horseId,
                HorseName = entry.Pairing.Horse.Name,
                JockeyId = jockeyId,
                JockeyName = entry.Pairing.Jockey.Jockey.FullName,
                HorseHistoryScore = Math.Round(horseScore, 2),
                JockeyHistoryScore = Math.Round(jockeyScore, 2),
                RoundTypeAvgScore = Math.Round(roundTypeAvgScore, 2),
                FormScore = Math.Round(formScore, 2)
            });
        }

        return ApiResponse<List<FormScoreDto>>.Ok(result.OrderByDescending(f => f.FormScore).ToList());
    }

    // =========================================================
    // Chỉ hỗ trợ Win
    // Đặt dự đoán: trừ ví + ghi ledger cùng transaction
    // Server-side gate
    //
    // FIX #2: Dùng ExecuteUpdateAsync để trừ Balance nguyên tử (tránh race condition).
    // FIX #3: Duplicate check dựa vào unique index UQ_Predictions_SpectatorEntry.
    // =========================================================
    public async Task<ApiResponse<PredictionResponseDto>> PlacePredictionAsync(
        int spectatorId, PlacePredictionDto dto, string? ipAddress)
    {
        if (dto.PointsPlaced <= 0)
            return ApiResponse<PredictionResponseDto>.Fail("Số điểm đặt dự đoán phải lớn hơn 0.");

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Server-side gate — không tin tưởng frontend
            var race = await _context.Races
                .FirstOrDefaultAsync(r => r.RaceId == dto.RaceId);
            if (race == null)
                return ApiResponse<PredictionResponseDto>.Fail("Không tìm thấy cuộc đua.");

            if (race.Status != RaceStatusPreRace)
                return ApiResponse<PredictionResponseDto>.Fail("Chỉ có thể đặt dự đoán sau khi Referee chốt danh sách xuất phát và trước khi cuộc đua bắt đầu.");

            if (race.IsPredictionGateClosed)
                return ApiResponse<PredictionResponseDto>.Fail("Cổng dự đoán đã đóng.");

            if (!race.IsPostPositionDrawn)
                return ApiResponse<PredictionResponseDto>.Fail("Danh sách xuất phát chưa được chốt hợp lệ.");

            var raceEntry = await _context.RaceEntries
                .FirstOrDefaultAsync(re => re.RaceEntryId == dto.RaceEntryId && re.RaceId == dto.RaceId);
            if (raceEntry == null || raceEntry.IsWithdrawn)
                return ApiResponse<PredictionResponseDto>.Fail("Ngựa này không hợp lệ hoặc đã rút khỏi cuộc đua.");

            // Chỉ nhận dự đoán trên entry đã Confirmed — entry Pending có thể bị
            // auto-cancel khi quá hạn xác nhận (sau draw, entry hợp lệ đều đã Confirmed).
            if (raceEntry.Status != "Confirmed")
                return ApiResponse<PredictionResponseDto>.Fail(
                    "Ngựa này chưa được xác nhận tham gia cuộc đua nên chưa thể đặt dự đoán.");

            // FIX #3: Kiểm tra duplicate trước khi thao tác ví
            // (unique index UQ_Predictions_SpectatorEntry chặn ở tầng DB,
            //  check sớm ở đây để trả lỗi thân thiện thay vì DbUpdateException)
            var alreadyPlaced = await _context.Predictions.AnyAsync(p =>
                p.SpectatorId == spectatorId &&
                p.RaceEntryId == dto.RaceEntryId &&
                p.PredictionType == PredictionTypeWin);
            if (alreadyPlaced)
                return ApiResponse<PredictionResponseDto>.Fail("Bạn đã đặt dự đoán Win cho ngựa này trong cuộc đua này.");

            // FIX #2: Trừ Balance nguyên tử bằng UPDATE có điều kiện —
            // nếu số dư không đủ, affected rows = 0 → phát hiện race condition.
            var now = DateTime.UtcNow;

            var affected = await _context.Wallets
                .Where(w => w.SpectatorId == spectatorId && w.Balance >= dto.PointsPlaced)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(w => w.Balance, w => w.Balance - dto.PointsPlaced)
                    .SetProperty(w => w.UpdatedAt, now));

            if (affected == 0)
                return ApiResponse<PredictionResponseDto>.Fail("Số dư ví không đủ để đặt dự đoán.");

            // Đọc lại Balance sau khi update để trả về cho client
            var walletBalance = await _context.Wallets
                .Where(w => w.SpectatorId == spectatorId)
                .Select(w => w.Balance)
                .FirstOrDefaultAsync();

            var walletId = await _context.Wallets
                .Where(w => w.SpectatorId == spectatorId)
                .Select(w => w.WalletId)
                .FirstOrDefaultAsync();

            var prediction = new Prediction
            {
                SpectatorId = spectatorId,
                RaceId = dto.RaceId,
                RaceEntryId = dto.RaceEntryId,
                PredictionType = PredictionTypeWin,
                PointsPlaced = dto.PointsPlaced,
                Status = "Pending",
                CreatedAt = now
            };
            _context.Predictions.Add(prediction);
            await _context.SaveChangesAsync(); // sinh PredictionId

            _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
            {
                WalletId = walletId,
                Amount = -dto.PointsPlaced,
                Type = TxnTypePredictionPlaced,
                ReferenceId = prediction.PredictionId.ToString(),
                CreatedAt = now
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            await _auditLog.LogAsync(
                actorId: spectatorId,
                action: "PlacePrediction",
                entityName: "Predictions",
                entityId: prediction.PredictionId.ToString(),
                ipAddress: ipAddress
            );

            return ApiResponse<PredictionResponseDto>.Ok(new PredictionResponseDto
            {
                PredictionId = prediction.PredictionId,
                RaceId = prediction.RaceId,
                RaceEntryId = prediction.RaceEntryId,
                PredictionType = prediction.PredictionType,
                PointsPlaced = prediction.PointsPlaced,
                Status = prediction.Status,
                PointsAwarded = prediction.PointsAwarded,
                CreatedAt = prediction.CreatedAt,
                WalletBalanceAfter = walletBalance
            }, "Đặt dự đoán thành công.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
