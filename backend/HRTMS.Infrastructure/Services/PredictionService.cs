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
    private const string RaceStatusUpcoming = "Upcoming";
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
    // REQ-F-PRD.1 — Admin cấu hình / đóng-mở cổng dự đoán
    // REQ-F-PRD.2 — Cổng chỉ mở sau Post Position Draw (BR-09)
    // =========================================================
    public async Task<ApiResponse<bool>> SetPredictionGateAsync(
        int raceId, PredictionGateConfigDto dto, int adminId, string? ipAddress)
    {
        var race = await _context.Races.FirstOrDefaultAsync(r => r.RaceId == raceId);
        if (race == null)
            return ApiResponse<bool>.Fail("Không tìm thấy Race.");

        // BR-09: chỉ cho phép MỞ cổng (IsPredictionGateClosed = false) khi đã bốc thăm
        if (dto.IsPredictionGateClosed == false && !race.IsPostPositionDrawn)
            return ApiResponse<bool>.Fail("Không thể mở cổng dự đoán khi chưa bốc thăm vị trí xuất phát (Post Position Draw).");

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
            return ApiResponse<PredictionGateStatusDto>.Fail("Không tìm thấy Race.");

        var status = new PredictionGateStatusDto
        {
            RaceId = race.RaceId,
            IsPostPositionDrawn = race.IsPostPositionDrawn,
            IsPredictionGateClosed = race.IsPredictionGateClosed,
            RaceStatus = race.Status,
            CanPredict = race.IsPostPositionDrawn
                         && !race.IsPredictionGateClosed
                         && race.Status == RaceStatusUpcoming
        };

        return ApiResponse<PredictionGateStatusDto>.Ok(status);
    }

    // =========================================================
    // REQ-F-PRD.4 — Form Score: 40% lịch sử ngựa + 35% lịch sử Jockey
    // + 25% kết quả trung bình theo loại vòng đua. Tính server-side
    // qua EF (dịch sang SQL thực thi tại DB) — KHÔNG AI/ML.
    //
    // GHI CHÚ: cần xác nhận lại tên field trên Pairing/Horse/JockeyProfile
    // (giả định Pairing.HorseId, Pairing.JockeyId, Horse.HorseName) —
    // chỉnh sửa property cho khớp entity thật trước khi build.
    // =========================================================
    public async Task<ApiResponse<List<FormScoreDto>>> GetFormScoresAsync(int raceId)
    {
        var race = await _context.Races.AsNoTracking()
            .Include(r => r.Round)
            .FirstOrDefaultAsync(r => r.RaceId == raceId);
        if (race == null)
            return ApiResponse<List<FormScoreDto>>.Fail("Không tìm thấy Race.");

        var entries = await _context.RaceEntries
            .AsNoTracking()
            .Where(re => re.RaceId == raceId && !re.IsWithdrawn)
            .Include(re => re.Pairing)
                .ThenInclude(p => p.Horse)
            .Include(re => re.Pairing)
                .ThenInclude(p => p.Jockey)
                    .ThenInclude(jp => jp.Jockey) // JockeyProfile.Jockey = User (lấy FullName)
            .ToListAsync();

        var result = new List<FormScoreDto>();

        foreach (var entry in entries)
        {
            var horseId = entry.Pairing.HorseId;
            var jockeyId = entry.Pairing.JockeyId;

            // 40% — lịch sử ngựa: tỉ lệ về Top-1 trên các race đã hoàn tất
            var horseFinishedEntries = await _context.RaceEntries
                .Where(re => re.Pairing.HorseId == horseId && re.FinishPosition != null)
                .ToListAsync();
            decimal horseScore = horseFinishedEntries.Count == 0
                ? 0
                : (decimal)horseFinishedEntries.Count(re => re.FinishPosition == 1)
                  / horseFinishedEntries.Count * 100m;

            // 35% — lịch sử Jockey: tỉ lệ về Top-1
            var jockeyFinishedEntries = await _context.RaceEntries
                .Where(re => re.Pairing.JockeyId == jockeyId && re.FinishPosition != null)
                .ToListAsync();
            decimal jockeyScore = jockeyFinishedEntries.Count == 0
                ? 0
                : (decimal)jockeyFinishedEntries.Count(re => re.FinishPosition == 1)
                  / jockeyFinishedEntries.Count * 100m;

            // 25% — kết quả trung bình theo loại vòng đua.
            // Round không có field RoundType riêng -> dùng Round.Name
            // (vd "Vòng loại"/"Bán kết"/"Chung kết") làm tiêu chí phân loại.
            var roundName = race.Round.Name;
            var sameRoundTypeEntries = await _context.RaceEntries
                .Where(re => re.Pairing.HorseId == horseId
                             && re.FinishPosition != null
                             && re.Race.Round.Name == roundName)
                .Select(re => re.FinishPosition!.Value)
                .ToListAsync();
            decimal roundTypeAvgScore = sameRoundTypeEntries.Count == 0
                ? 0
                : 100m - ((decimal)sameRoundTypeEntries.Average() - 1m) * 10m; // điểm càng cao nếu vị trí trung bình càng gần 1

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
    // REQ-F-PRD.3 — Chỉ hỗ trợ Win
    // REQ-F-PRD.5 — Đặt dự đoán: trừ ví + ghi ledger cùng transaction (BR-39)
    // REQ-F-PRD.6 — Server-side gate (BR-23, EC-05)
    // =========================================================
    public async Task<ApiResponse<PredictionResponseDto>> PlacePredictionAsync(
        int spectatorId, PlacePredictionDto dto, string? ipAddress)
    {
        if (dto.PointsPlaced <= 0)
            return ApiResponse<PredictionResponseDto>.Fail("Số điểm đặt dự đoán phải lớn hơn 0.");

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // PRD.6: server-side gate — không tin tưởng frontend
            var race = await _context.Races
                .FirstOrDefaultAsync(r => r.RaceId == dto.RaceId);
            if (race == null)
                return ApiResponse<PredictionResponseDto>.Fail("Không tìm thấy Race.");

            if (race.Status != RaceStatusUpcoming)
                return ApiResponse<PredictionResponseDto>.Fail("Cuộc đua không còn ở trạng thái Upcoming, không thể đặt dự đoán.");

            if (race.IsPredictionGateClosed)
                return ApiResponse<PredictionResponseDto>.Fail("Cổng dự đoán đã đóng.");

            if (!race.IsPostPositionDrawn)
                return ApiResponse<PredictionResponseDto>.Fail("Chưa bốc thăm vị trí xuất phát, cổng dự đoán chưa thể mở.");

            var raceEntry = await _context.RaceEntries
                .FirstOrDefaultAsync(re => re.RaceEntryId == dto.RaceEntryId && re.RaceId == dto.RaceId);
            if (raceEntry == null || raceEntry.IsWithdrawn)
                return ApiResponse<PredictionResponseDto>.Fail("RaceEntry không hợp lệ hoặc đã rút lui.");

            // PRD.3: chỉ hỗ trợ Win — không nhận loại khác từ client
            var wallet = await _context.Wallets
                .FirstOrDefaultAsync(w => w.SpectatorId == spectatorId);
            if (wallet == null)
                return ApiResponse<PredictionResponseDto>.Fail("Không tìm thấy ví của Spectator.");

            if (wallet.Balance < dto.PointsPlaced)
                return ApiResponse<PredictionResponseDto>.Fail("Số dư ví không đủ để đặt dự đoán.");

            var now = DateTime.UtcNow;

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
            // Save trước để DB sinh PredictionId, dùng làm ReferenceId cho ledger.
            // Vẫn nằm trong cùng DB transaction nên không phá tính nguyên tử.
            await _context.SaveChangesAsync();

            wallet.Balance -= dto.PointsPlaced;
            wallet.UpdatedAt = now;

            _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
            {
                Wallet = wallet,
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
                WalletBalanceAfter = wallet.Balance
            }, "Đặt dự đoán thành công.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}