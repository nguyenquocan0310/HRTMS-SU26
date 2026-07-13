using HRTMS.Core.DTOs.Result;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace HRTMS.Infrastructure.Services
{
    public class ResultService : IResultService
    {
        private readonly HRTMSDbContext _context;
        private readonly IAuditLogService _auditLog;
        private readonly INotificationService _notificationService; // FIX #7

        // Thưởng dự đoán Win cố định 200 điểm (quyết định nhóm 2026-07-11, PRD.1):
        // KHÔNG cấu hình theo Tournament — schema v2 đã bỏ cột PredictionRewardPoints.
        private const int PredictionWinRewardPoints = 200;

        public ResultService(HRTMSDbContext context, IAuditLogService auditLog, INotificationService notificationService)
        {
            _context = context;
            _auditLog = auditLog;
            _notificationService = notificationService; // FIX #7
        }

        // =====================================================================
        // Danh sách Race Unofficial + cờ điều kiện chặn Declare
        // =====================================================================
        public async Task<List<UnofficialRaceListItemDto>> GetUnofficialRacesAsync(int? tournamentId)
        {
            var query = _context.Races
                .Include(r => r.Round).ThenInclude(rd => rd.Tournament)
                .Include(r => r.RaceReport)
                .Include(r => r.RaceEntries)
                .Where(r => r.Status == "Unofficial");

            if (tournamentId.HasValue)
                query = query.Where(r => r.Round.TournamentId == tournamentId.Value);

            var races = await query.ToListAsync();
            var result = new List<UnofficialRaceListItemDto>(races.Count);

            foreach (var race in races)
            {
                var hasPendingProtests = await _context.Protests
                    .AnyAsync(p => p.RaceId == race.RaceId && p.Status == "Pending");

                var prizeOk = await IsPrizeDistributionsValidAsync(race.Round.TournamentId);
                var rankingOk = IsRankingIntegrityValid(race.RaceEntries);
                var weighOutOk = IsPostRaceWeighInComplete(race.RaceEntries);

                result.Add(new UnofficialRaceListItemDto
                {
                    RaceId = race.RaceId,
                    TournamentId = race.Round.TournamentId,
                    TournamentName = race.Round.Tournament.Name,
                    RoundName = race.Round.Name,
                    RaceNumber = race.RaceNumber,
                    ScheduledTime = race.ScheduledTime,
                    HasRaceReport = race.RaceReport != null,
                    IsRaceReportLocked = race.RaceReport?.IsLocked ?? false,
                    HasPendingProtests = hasPendingProtests,
                    PrizeDistributionsConfigured = prizeOk,
                    RankingIntegrityValid = rankingOk,
                    PostRaceWeighInComplete = weighOutOk
                });
            }

            return result;
        }

        // =====================================================================
        // Declare Official (ACID 6 bước)
        // =====================================================================
        public async Task<DeclareOfficialResultDto> DeclareOfficialAsync(
            int raceId, DeclareOfficialDto dto, int adminUserId)
        {
            if (!dto.ConfirmedByAdmin)
                throw new ArgumentException("Phải xác nhận trước khi công bố kết quả chính thức");

            // Load đầy đủ data liên quan — cùng pattern với CancelTournamentAsync
            var race = await _context.Races
                .Include(r => r.Round).ThenInclude(rd => rd.Tournament).ThenInclude(t => t.PrizeDistributions)
                .Include(r => r.RaceReport)
                .Include(r => r.RaceEntries).ThenInclude(re => re.Pairing).ThenInclude(p => p.Horse)
                .Include(r => r.RaceEntries).ThenInclude(re => re.Pairing).ThenInclude(p => p.Jockey)
                .Include(r => r.Predictions)
                .FirstOrDefaultAsync(r => r.RaceId == raceId)
                ?? throw new KeyNotFoundException($"Không tìm thấy cuộc đua #{raceId}.");

            // ---------------------------------------------------------------
            // VALIDATION TIỀN ĐIỀU KIỆN
            // ---------------------------------------------------------------

            // Idempotent guard chống double-click
            if (race.Status != "Unofficial")
                throw new InvalidOperationException(
                    $"Không thể công bố kết quả: cuộc đua đang ở trạng thái '{race.Status}', " +
                    "không phải trạng thái chờ công bố. Có thể kết quả đã được công bố ở thao tác khác.");

            if (race.RaceReport == null)
                throw new InvalidOperationException("Cuộc đua chưa có biên bản thi đấu.");

            if (race.RaceReport.IsLocked)
                throw new InvalidOperationException("Biên bản thi đấu đã bị khóa từ trước");

            var hasPendingProtests = await _context.Protests
                .AnyAsync(p => p.RaceId == raceId && p.Status == "Pending");
            if (hasPendingProtests)
                throw new InvalidOperationException(
                    "Còn khiếu nại chưa xử lý xong nên chưa thể công bố kết quả chính thức.");

            if (!await IsPrizeDistributionsValidAsync(race.Round.TournamentId))
                throw new InvalidOperationException(
                    "Giải chưa cấu hình đủ tỷ lệ chia thưởng (tổng phải đạt 100%).");

            if (!IsRankingIntegrityValid(race.RaceEntries))
                throw new InvalidOperationException(
                    "Thứ hạng chưa hợp lệ sau khi điều chỉnh khiếu nại. " +
                    "Vui lòng kiểm tra lại thứ hạng về đích trước khi công bố.");

            if (!IsPostRaceWeighInComplete(race.RaceEntries))
                throw new InvalidOperationException(
                    "Còn cặp đấu chưa được cân sau đua.");

            // ---------------------------------------------------------------
            // ACID TRANSACTION — 6 BƯỚC
            // ---------------------------------------------------------------
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;
                var result = new DeclareOfficialResultDto { RaceId = race.RaceId };

                // BƯỚC 1 — Race.Status = 'Official'
                race.Status = "Official";
                race.UpdatedAt = now;

                // BƯỚC 2 — Khóa cứng biên bản thi đấu điện tử
                race.RaceReport.IsLocked = true;
                race.RaceReport.LockedAt = now;

                // BƯỚC 3 — Đối chiếu dự đoán & trả thưởng ví ảo Spectator
                var (settledCount, refundedCount) = await SettlePredictionsAsync(race, now);
                result.PredictionsSettledCount = settledCount;
                result.PredictionsRefundedCount = refundedCount;

                // BƯỚC 4 — Cập nhật Leaderboard nguồn (PointsAwarded trên RaceEntries)
                UpdateLeaderboardPoints(race.RaceEntries);

                // BƯỚC 5 — Tính & phân bổ tiền thưởng quỹ Purse
                var (payoutsCreated, remainder) = AllocatePurse(race, now);
                result.PursePayoutsCreatedCount = payoutsCreated;
                result.RemainderAmount = remainder;

                // BƯỚC 5b — Progression: đánh dấu Qualified/AlsoEligible/Eliminated
                // theo AdvancementRule của giải, và tự chốt Round.Status = 'Completed'
                // khi mọi race trong round đã Official/Cancelled.
                await ApplyProgressionAsync(race, now);

                // BƯỚC 6 — Ghi AuditLog
                await _context.SaveChangesAsync(); // lưu trước để có RaceId/EntryId chắc chắn tồn tại cho log

                await _auditLog.LogAsync(
                    actorId: adminUserId,
                    action: "Declare_Official",
                    entityName: "Race",
                    entityId: race.RaceId.ToString(),
                    oldValue: "Unofficial",
                    newValue: "Official"
                );

                await transaction.CommitAsync();

                result.RaceStatus = "Official";
                result.OfficialAt = race.RaceReport.LockedAt!.Value;

                return result;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // =====================================================================
        // Helper: Bước 5b — Progression sau khi race Official
        // =====================================================================
        // Chỉ tính advancement khi tournament còn round SAU round hiện tại
        // (chung kết không có "đi tiếp"). MVP hỗ trợ rule 'TopPerRace';
        // 'EarningsBased'/'Hybrid' cần earnings toàn round nên xử lý ở bước sau
        // (P1) — entry giữ AdvancementStatus = NULL cho tới khi có quyết định.
        private async Task ApplyProgressionAsync(Race race, DateTime now)
        {
            var tournament = race.Round.Tournament;

            var hasNextRound = await _context.Rounds.AnyAsync(r =>
                r.TournamentId == tournament.TournamentId &&
                r.SequenceOrder > race.Round.SequenceOrder);

            if (hasNextRound && tournament.AdvancementRule == "TopPerRace")
            {
                var topN = tournament.AdvancementCount;

                // Entry hợp lệ để xét: có FinishPosition, không Cancelled/Disqualified.
                var finishers = race.RaceEntries
                    .Where(re => re.Status != "Cancelled" &&
                                 re.Status != "Disqualified" &&
                                 re.FinishPosition != null)
                    .ToList();

                foreach (var entry in finishers)
                {
                    var pos = entry.FinishPosition!.Value;
                    // Dead heat: nhóm đồng hạng xét theo số entry đứng TRƯỚC nhóm.
                    var ahead = finishers.Count(re => re.FinishPosition!.Value < pos);
                    var tieSize = finishers.Count(re => re.FinishPosition!.Value == pos);

                    entry.AdvancementRank = pos;
                    if (ahead + tieSize <= topN)
                    {
                        entry.AdvancementStatus = "Qualified";
                        entry.AdvancementReason = $"Top {topN} của cuộc đua (TopPerRace)";
                    }
                    else if (ahead < topN)
                    {
                        // Nhóm đồng hạng vắt qua ranh Top N — Admin quyết định khi
                        // allocate round sau (AlsoEligible vẫn được phép allocate).
                        entry.AdvancementStatus = "AlsoEligible";
                        entry.AdvancementReason = $"Đồng hạng tại ranh Top {topN} — chờ Admin quyết định";
                    }
                    else
                    {
                        entry.AdvancementStatus = "Eliminated";
                        entry.AdvancementReason = $"Ngoài Top {topN} của cuộc đua";
                    }
                    entry.UpdatedAt = now;
                }

                // Disqualified → loại thẳng; Cancelled/không chạy → giữ NULL (không xét).
                foreach (var entry in race.RaceEntries.Where(re => re.Status == "Disqualified"))
                {
                    entry.AdvancementStatus = "Eliminated";
                    entry.AdvancementReason = "Bị loại khỏi cuộc đua (Disqualified)";
                    entry.UpdatedAt = now;
                }
            }

            // Round completion: mọi race trong round đã Official/Cancelled → 'Completed'.
            // Race hiện tại vừa set Official in-memory (DB còn 'Unofficial') nên loại nó khỏi query.
            var hasUnfinishedSibling = await _context.Races.AnyAsync(r =>
                r.RoundId == race.RoundId &&
                r.RaceId != race.RaceId &&
                r.Status != "Official" &&
                r.Status != "Cancelled");
            if (!hasUnfinishedSibling)
            {
                race.Round.Status = "Completed";
                race.Round.UpdatedAt = now;
            }
        }

        // =====================================================================
        // Helper: Bước 3 — Đối chiếu & trả thưởng dự đoán
        // =====================================================================
        private async Task<(int settled, int refunded)> SettlePredictionsAsync(Race race, DateTime now)
        {
            var predictions = await _context.Predictions
                .Where(p => p.RaceId == race.RaceId && p.Status == "Pending")
                .ToListAsync();

            int settled = 0, refunded = 0;

            // Schema v2 đã bỏ Tournament.PredictionRewardPoints → dùng hằng số chuẩn (+200).
            var rewardPoints = PredictionWinRewardPoints;

            // Tập ngựa về Nhất chính thức — cho phép đồng hạng
            var winningEntryIds = race.RaceEntries
                .Where(re => re.FinishPosition == 1 && re.Status != "Cancelled" && re.Status != "Disqualified")
                .Select(re => re.RaceEntryId)
                .ToHashSet();

            // Map RaceEntryId -> Status để biết Disqualified/Cancelled
            var entryStatusById = race.RaceEntries.ToDictionary(re => re.RaceEntryId, re => re.Status);

            // Gộp theo Spectator để ghi 1 dòng VPT/Spectator (tránh update phi tất định)
            var rewardBySpectator = new Dictionary<int, int>();
            var refundBySpectator = new Dictionary<int, int>();

            foreach (var pred in predictions)
            {
                var entryStatus = entryStatusById.GetValueOrDefault(pred.RaceEntryId, "Unknown");

                if (entryStatus == "Cancelled" || entryStatus == "Disqualified")
                {
                    pred.Status = "Refunded";
                    refundBySpectator[pred.SpectatorId] =
                        refundBySpectator.GetValueOrDefault(pred.SpectatorId) + pred.PointsPlaced;
                    refunded++;
                    continue;
                }

                if (winningEntryIds.Contains(pred.RaceEntryId))
                {
                    pred.Status = "Won";
                    pred.PointsAwarded = rewardPoints;
                    rewardBySpectator[pred.SpectatorId] =
                        rewardBySpectator.GetValueOrDefault(pred.SpectatorId) + rewardPoints;
                }
                else
                {
                    pred.Status = "Lost";
                    pred.PointsAwarded = 0;
                }

                settled++;
            }

            foreach (var (spectatorId, amount) in rewardBySpectator)
                await ApplyWalletTransactionAsync(spectatorId, amount, "Prediction Win Reward", now);

            foreach (var (spectatorId, amount) in refundBySpectator)
                await ApplyWalletTransactionAsync(spectatorId, amount, "Prediction Refund", now);

            // FIX #7: Gửi notification cho Spectator sau khi settle
            var winnerIds = rewardBySpectator.Keys.ToList();
            var refundIds = refundBySpectator.Keys.ToList();
            var loserIds = predictions
                .Where(p => p.Status == "Lost")
                .Select(p => p.SpectatorId)
                .Distinct()
                .Except(winnerIds)
                .ToList();

            if (winnerIds.Count > 0)
                await _notificationService.SendBulkAsync(
                    recipientIds: winnerIds,
                    title: "Dự đoán thắng! 🎉",
                    message: $"Bạn dự đoán đúng kết quả cuộc đua #{race.RaceNumber}. Bạn được cộng {rewardPoints} điểm vào ví.",
                    type: "In-app",
                    relatedEntityType: "Race",
                    relatedEntityId: race.RaceId);

            if (loserIds.Count > 0)
                await _notificationService.SendBulkAsync(
                    recipientIds: loserIds,
                    title: "Kết quả dự đoán",
                    message: $"Cuộc đua #{race.RaceNumber} đã công bố kết quả chính thức. Dự đoán của bạn chưa trúng lần này.",
                    type: "In-app",
                    relatedEntityType: "Race",
                    relatedEntityId: race.RaceId);

            if (refundIds.Count > 0)
                await _notificationService.SendBulkAsync(
                    recipientIds: refundIds,
                    title: "Hoàn điểm dự đoán",
                    message: $"Ngựa bạn dự đoán ở cuộc đua #{race.RaceNumber} đã bị hủy hoặc truất quyền. Điểm dự đoán đã được hoàn về ví.",
                    type: "In-app",
                    relatedEntityType: "Race",
                    relatedEntityId: race.RaceId);

            return (settled, refunded);
        }

        /// <summary>
        /// Cộng/trừ ví Spectator + ghi 1 dòng sổ cái trong cùng transaction.
        /// Giữ bất biến Balance = SUM(VirtualPointsTransactions.Amount).
        /// FIX: dùng ExecuteUpdateAsync (cộng nguyên tử theo điều kiện WHERE) thay vì
        /// đọc entity rồi += và SaveChanges — tránh lost-update khi 2 race cùng ảnh
        /// hưởng 1 Spectator được Declare Official gần như đồng thời (Wallet không có
        /// RowVersion nên EF không tự phát hiện conflict). Đồng bộ pattern với
        /// EmergencyDisqualificationService / TournamentSevice.CancelTournamentAsync.
        /// </summary>
        private async Task ApplyWalletTransactionAsync(int spectatorId, int amount, string type, DateTime now)
        {
            if (amount == 0) return;

            var updated = await _context.Wallets
                .Where(w => w.SpectatorId == spectatorId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(w => w.Balance, w => w.Balance + amount)
                    .SetProperty(w => w.UpdatedAt, now));

            if (updated == 0)
            {
                // Ví thiếu là lỗi dữ liệu nghiêm trọng (mọi Spectator có Wallet từ lúc
                // đăng ký). Throw để transaction Declare Official ROLLBACK toàn bộ —
                // tuyệt đối không đánh dấu prediction Won/Refunded mà không cộng điểm
                // (mất thưởng im lặng).
                throw new InvalidOperationException("WALLET_NOT_FOUND");
            }

            var walletId = await _context.Wallets
                .Where(w => w.SpectatorId == spectatorId)
                .Select(w => w.WalletId)
                .FirstAsync();

            _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
            {
                WalletId = walletId,
                Amount = amount,
                Type = type,
                CreatedAt = now
            });
        }

        // =====================================================================
        // Helper: Bước 4 — set PointsAwarded theo thứ hạng (nguồn Leaderboard)
        // =====================================================================
        private static void UpdateLeaderboardPoints(IEnumerable<RaceEntry> entries)
        {
            foreach (var entry in entries)
            {
                if (entry.Status == "Cancelled" || entry.Status == "Disqualified" || entry.FinishPosition == null)
                    continue;

                entry.PointsAwarded = entry.FinishPosition switch
                {
                    1 => 10,
                    2 => 5,
                    3 => 3,
                    _ => 0
                };
            }
        }

        // =====================================================================
        // Helper: Bước 5 — Phân bổ Purse theo PrizeDistributions
        // =====================================================================
        private (int payoutsCreated, decimal? remainder) AllocatePurse(Race race, DateTime now)
        {
            var distributions = race.Round.Tournament.PrizeDistributions
                .OrderBy(pd => pd.Position)
                .ToList();

            var purseAmount = race.PurseAmount;
            int created = 0;

            // Nhóm theo FinishPosition để xử lý đồng hạng
            var finishersByPosition = race.RaceEntries
                .Where(re => re.Status != "Cancelled" && re.Status != "Disqualified" && re.FinishPosition != null)
                .GroupBy(re => re.FinishPosition!.Value)
                .OrderBy(g => g.Key)
                .ToList();

            decimal allocatedPercentage = 0m;
            int positionPointer = 1;

            foreach (var group in finishersByPosition)
            {
                var groupSize = group.Count();
                var occupiedPositions = Enumerable.Range(positionPointer, groupSize).ToList();
                positionPointer += groupSize;

                var percentForGroup = distributions
                    .Where(pd => occupiedPositions.Contains(pd.Position))
                    .Sum(pd => pd.Percentage);

                if (percentForGroup <= 0) continue;

                allocatedPercentage += percentForGroup;
                var groupPrizeAmount = purseAmount * (percentForGroup / 100m) / groupSize;

                foreach (var entry in group)
                    created += CreatePayoutForEntry(entry, groupPrizeAmount, now);
            }

            // Phần dư khi số ngựa về đích hợp lệ < số vị trí thưởng
            decimal? remainder = null;
            var unallocated = 100m - allocatedPercentage;
            if (unallocated > 0)
                remainder = purseAmount * (unallocated / 100m);

            return (created, remainder);
        }

        /// <summary>
        /// Tạo PursePayouts cho Jockey (10% Nhất / 5% Nhì-Tư) và Owner (phần còn lại).
        /// PRZ.3 "phí cố định cho Jockey ngoài top": quyết định nhóm 2026-07-11 —
        /// NGOÀI scope MVP (SRS không nêu số tiền/nguồn quỹ). Chỉ nhóm có % > 0 trong
        /// PrizeDistributions mới có payout; ngựa ngoài top không nhận gì ở phase này.
        /// </summary>
        private int CreatePayoutForEntry(RaceEntry entry, decimal entryPrizeAmount, DateTime now)
        {
            var jockeyShareRate = entry.FinishPosition switch
            {
                1 => 0.10m,
                2 or 3 or 4 => 0.05m,
                _ => 0m
            };

            var jockeyAmount = Math.Round(entryPrizeAmount * jockeyShareRate, 2, MidpointRounding.AwayFromZero);
            var ownerAmount = entryPrizeAmount - jockeyAmount;

            int count = 0;

            if (jockeyAmount > 0)
            {
                _context.PursePayouts.Add(new PursePayout
                {
                    RaceEntryId = entry.RaceEntryId,
                    RecipientUserId = entry.Pairing.JockeyId, // JockeyId = UserId (1:1 extension)
                    Role = "Jockey",
                    CalculatedAmount = jockeyAmount,
                    PayoutStatus = "Unpaid",
                    UpdatedAt = now
                });
                count++;
            }

            if (ownerAmount > 0)
            {
                _context.PursePayouts.Add(new PursePayout
                {
                    RaceEntryId = entry.RaceEntryId,
                    RecipientUserId = entry.Pairing.Horse.OwnerId, // OwnerId = UserId (1:1 extension)
                    Role = "Owner",
                    CalculatedAmount = ownerAmount,
                    PayoutStatus = "Unpaid",
                    UpdatedAt = now
                });
                count++;
            }

            entry.EarningsAwarded = entryPrizeAmount;

            return count;
        }

        // =====================================================================
        // Validation helpers
        // =====================================================================

        /// <summary>Tổng PrizeDistributions của giải phải = 100%.</summary>
        private async Task<bool> IsPrizeDistributionsValidAsync(int tournamentId)
        {
            var distributions = await _context.PrizeDistributions
                .Where(pd => pd.TournamentId == tournamentId)
                .ToListAsync();

            if (distributions.Count == 0) return false;

            // Dùng Math.Round giống pattern SetPrizeDistributionsAsync (TournamentSevice) để
            // tránh floating point error khi so sánh decimal.
            return Math.Round(distributions.Sum(pd => pd.Percentage), 2) == 100m;
        }

        /// <summary>
        /// Standard-ranking integrity check.
        /// Cho phép đồng hạng (1,1,3) nhưng không cho thiếu vị trí (1,2,4 — nhảy cóc).
        /// </summary>
        private static bool IsRankingIntegrityValid(IEnumerable<RaceEntry> entries)
        {
            var positions = entries
                .Where(re => re.Status != "Cancelled" && re.Status != "Disqualified")
                .Select(re => re.FinishPosition)
                .ToList();

            if (positions.Any(p => p == null)) return false;

            var sorted = positions.Select(p => p!.Value).OrderBy(p => p).ToList();
            if (sorted.Count == 0) return true; // race rỗng — "ngựa bao nhiêu đua bấy nhiêu"

            int expectedNext = 1, i = 0;
            while (i < sorted.Count)
            {
                int value = sorted[i];
                if (value != expectedNext) return false;

                int groupSize = sorted.Count(x => x == value);
                expectedNext += groupSize;
                i += groupSize;
            }

            return true;
        }

        /// <summary>Mọi entry hợp lệ phải có PostRaceJockeyWeight trước khi Declare.</summary>
        private static bool IsPostRaceWeighInComplete(IEnumerable<RaceEntry> entries)
        {
            return entries
                .Where(re => re.Status != "Cancelled" && re.Status != "Disqualified")
                .All(re => re.PostRaceJockeyWeight != null);
        }
    }
}