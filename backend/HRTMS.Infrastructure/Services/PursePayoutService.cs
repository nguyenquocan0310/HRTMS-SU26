using HRTMS.Core.DTOs.Purse;
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
    public class PursePayoutService : IPursePayoutService
    {
        private readonly HRTMSDbContext _context;
        private readonly IAuditLogService _auditLog;

        private static readonly string[] ValidStatuses = { "Unpaid", "Paid" };

        public PursePayoutService(HRTMSDbContext context, IAuditLogService auditLog)
        {
            _context = context;
            _auditLog = auditLog;
        }

        // =====================================================================
        // Bảng phân bổ Purse + dòng Remainder của 1 cuộc đua
        // =====================================================================
        public async Task<RacePayoutSummaryDto> GetRacePayoutsAsync(int raceId)
        {
            var race = await _context.Races
                .Include(r => r.Round).ThenInclude(rd => rd.Tournament)
                .FirstOrDefaultAsync(r => r.RaceId == raceId)
                ?? throw new KeyNotFoundException("Không tìm thấy cuộc đua.");

            var payouts = await _context.PursePayouts
                .Include(p => p.RecipientUser)
                .Include(p => p.RaceEntry).ThenInclude(re => re.Pairing).ThenInclude(pa => pa.Horse)
                .Where(p => p.RaceEntry.RaceId == raceId)
                .OrderBy(p => p.RaceEntry.FinishPosition)
                .ThenBy(p => p.Role)
                .ToListAsync();

            var items = payouts.Select(MapItem).ToList();
            var totalAllocated = items.Sum(i => i.CalculatedAmount);

            return new RacePayoutSummaryDto
            {
                RaceId = race.RaceId,
                RaceNumber = race.RaceNumber,
                RoundName = race.Round.Name,
                TournamentName = race.Round.Tournament.Name,
                RaceStatus = race.Status,
                PurseAmount = race.PurseAmount,
                TotalAllocated = totalAllocated,
                // PRZ.4: remainder derive on-the-fly (quyết định nhóm — không persist).
                // Clamp về 0 phòng dữ liệu payout bất thường vượt quỹ — không hiển thị số âm.
                RemainderAmount = Math.Max(0m, race.PurseAmount - totalAllocated),
                Payouts = items
            };
        }

        // =====================================================================
        // Đổi trạng thái Paid/Unpaid + ghi AuditLog
        // =====================================================================
        public async Task<PursePayoutItemDto> UpdatePayoutStatusAsync(
            int payoutId, MarkPayoutStatusDto dto, int adminUserId)
        {
            var newStatus = (dto.PayoutStatus ?? string.Empty).Trim();
            if (!ValidStatuses.Contains(newStatus))
                throw new ArgumentException("Trạng thái chi thưởng chỉ nhận 'Paid' hoặc 'Unpaid'.");

            var payout = await _context.PursePayouts
                .Include(p => p.RecipientUser)
                .Include(p => p.RaceEntry).ThenInclude(re => re.Pairing).ThenInclude(pa => pa.Horse)
                .FirstOrDefaultAsync(p => p.PursePayoutId == payoutId)
                ?? throw new KeyNotFoundException("Không tìm thấy khoản chi thưởng.");

            var oldStatus = payout.PayoutStatus;

            // Không đổi gì → trả về luôn, không ghi audit thừa
            if (oldStatus == newStatus)
                return MapItem(payout);

            var now = DateTime.UtcNow;
            payout.PayoutStatus = newStatus;
            payout.PaidAt = newStatus == "Paid" ? now : null;   // clear PaidAt khi quay lại Unpaid
            payout.UpdatedByAdminId = adminUserId;
            payout.UpdatedAt = now;

            // LogAsync tự SaveChangesAsync → lưu payout + audit trong 1 SaveChanges (1 transaction)
            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Cập nhật trạng thái chi trả thưởng",
                entityName: "PursePayout",
                entityId: payout.PursePayoutId.ToString(),
                oldValue: oldStatus,
                newValue: newStatus
            );

            return MapItem(payout);
        }

        // =====================================================================
        // Lịch sử thưởng tích lũy theo người nhận (Owner/Jockey)
        // =====================================================================
        public async Task<List<EarningsHistoryItemDto>> GetEarningsHistoryAsync(
            int? recipientUserId, string? role)
        {
            var query = _context.PursePayouts
                .Include(p => p.RecipientUser)
                .AsQueryable();

            if (recipientUserId.HasValue)
                query = query.Where(p => p.RecipientUserId == recipientUserId.Value);

            if (!string.IsNullOrWhiteSpace(role))
                query = query.Where(p => p.Role == role);

            var payouts = await query.ToListAsync();

            return payouts
                .GroupBy(p => new { p.RecipientUserId, p.Role, p.RecipientUser.FullName })
                .Select(g => new EarningsHistoryItemDto
                {
                    RecipientUserId = g.Key.RecipientUserId,
                    RecipientName = g.Key.FullName,
                    Role = g.Key.Role,
                    TotalEarnings = g.Sum(p => p.CalculatedAmount),
                    PaidAmount = g.Where(p => p.PayoutStatus == "Paid").Sum(p => p.CalculatedAmount),
                    UnpaidAmount = g.Where(p => p.PayoutStatus == "Unpaid").Sum(p => p.CalculatedAmount),
                    PayoutCount = g.Count()
                })
                .OrderByDescending(e => e.TotalEarnings)
                .ToList();
        }

        // =====================================================================
        // Owner tự xem tiền thưởng của mình (self-scoped)
        // Chỉ payout Role="Owner" của chính ownerUserId; chi tiết từng dòng
        // (ngựa, hạng, số tiền, Paid/Unpaid) + tổng hợp.
        // =====================================================================
        public async Task<OwnerEarningsDto> GetMyEarningsAsync(int ownerUserId)
        {
            var payouts = await _context.PursePayouts
                .Include(p => p.RecipientUser)
                .Include(p => p.RaceEntry).ThenInclude(re => re.Pairing).ThenInclude(pa => pa.Horse)
                .Where(p => p.RecipientUserId == ownerUserId && p.Role == "Owner")
                .OrderByDescending(p => p.UpdatedAt)
                .ToListAsync();

            var items = payouts.Select(MapItem).ToList();

            return new OwnerEarningsDto
            {
                OwnerUserId = ownerUserId,
                TotalEarnings = items.Sum(i => i.CalculatedAmount),
                PaidAmount = items.Where(i => i.PayoutStatus == "Paid").Sum(i => i.CalculatedAmount),
                UnpaidAmount = items.Where(i => i.PayoutStatus == "Unpaid").Sum(i => i.CalculatedAmount),
                PayoutCount = items.Count,
                Payouts = items
            };
        }

        // =====================================================================
        // PRZ.5 — Quỹ tổng hợp cấp Cuộc đua
        // =====================================================================
        public async Task<RacePurseSummaryDto> GetRacePurseSummaryAsync(int raceId, int userId, string role)
        {
            var race = await _context.Races
                .Include(r => r.Round).ThenInclude(rd => rd.Tournament)
                .FirstOrDefaultAsync(r => r.RaceId == raceId)
                ?? throw new KeyNotFoundException("Không tìm thấy cuộc đua.");

            await EnsureRaceAccessAsync(raceId, userId, role);

            var payouts = await _context.PursePayouts
                .Include(p => p.RecipientUser)
                .Include(p => p.RaceEntry).ThenInclude(re => re.Pairing).ThenInclude(pa => pa.Horse)
                .Where(p => p.RaceEntry.RaceId == raceId)
                .OrderBy(p => p.RaceEntry.FinishPosition)
                .ThenBy(p => p.Role)
                .ToListAsync();

            var items = payouts.Select(MapItem).ToList();
            return BuildRaceSummary(race, items);
        }

        // =====================================================================
        // PRZ.5 — Quỹ tổng hợp cấp Vòng đấu
        // =====================================================================
        public async Task<RoundPurseSummaryDto> GetRoundPurseSummaryAsync(int roundId, int userId, string role)
        {
            var round = await _context.Rounds
                .Include(r => r.Tournament)
                .Include(r => r.Races)
                .FirstOrDefaultAsync(r => r.RoundId == roundId)
                ?? throw new KeyNotFoundException("Không tìm thấy vòng đấu.");

            await EnsureRoundAccessAsync(roundId, userId, role);

            // Aggregate payout theo race trong 1 query — tránh N+1 khi vòng có nhiều race.
            var payoutAgg = await _context.PursePayouts
                .Where(p => p.RaceEntry.Race.RoundId == roundId)
                .GroupBy(p => new { p.RaceEntry.RaceId, p.PayoutStatus })
                .Select(g => new PayoutAggRow { RaceId = g.Key.RaceId, PayoutStatus = g.Key.PayoutStatus, Amount = g.Sum(x => x.CalculatedAmount) })
                .ToListAsync();

            var races = round.Races
                .OrderBy(r => r.RaceNumber)
                .Select(race => BuildRaceItem(race, payoutAgg.Where(a => a.RaceId == race.RaceId)))
                .ToList();

            var dto = new RoundPurseSummaryDto
            {
                RoundId = round.RoundId,
                RoundName = round.Name,
                TournamentName = round.Tournament.Name,
                RoundStatus = round.Status,
                AllocatedFund = races.Sum(r => r.AllocatedFund),
                PaidAmount = races.Sum(r => r.PaidAmount),
                PendingAmount = races.Sum(r => r.PendingAmount),
                TotalRaceCount = races.Count,
                PaidRaceCount = races.Count(r => r.PayoutStatus == "Paid"),
                HasDiscrepancy = races.Any(r => r.HasDiscrepancy),
                Races = races
            };
            dto.RemainingAmount = Math.Max(0m, dto.AllocatedFund - dto.PaidAmount - dto.PendingAmount);

            return dto;
        }

        // =====================================================================
        // PRZ.5 — Quỹ tổng hợp cấp Giải đấu
        // =====================================================================
        public async Task<TournamentPurseSummaryDto> GetTournamentPurseSummaryAsync(int tournamentId, int userId, string role)
        {
            var tournament = await _context.Tournaments
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId)
                ?? throw new KeyNotFoundException("Không tìm thấy giải đấu.");

            await EnsureTournamentAccessAsync(tournamentId, userId, role);

            var payoutAgg = await _context.PursePayouts
                .Where(p => p.RaceEntry.Race.Round.TournamentId == tournamentId)
                .GroupBy(p => new { p.RaceEntry.RaceId, p.PayoutStatus })
                .Select(g => new PayoutAggRow { RaceId = g.Key.RaceId, PayoutStatus = g.Key.PayoutStatus, Amount = g.Sum(x => x.CalculatedAmount) })
                .ToListAsync();

            var rounds = tournament.Rounds
                .OrderBy(r => r.SequenceOrder)
                .Select(round =>
                {
                    var races = round.Races
                        .OrderBy(r => r.RaceNumber)
                        .Select(race => BuildRaceItem(race, payoutAgg.Where(a => a.RaceId == race.RaceId)))
                        .ToList();

                    return new RoundPurseSummaryItemDto
                    {
                        RoundId = round.RoundId,
                        RoundName = round.Name,
                        RoundStatus = round.Status,
                        AllocatedFund = races.Sum(r => r.AllocatedFund),
                        PaidAmount = races.Sum(r => r.PaidAmount),
                        PendingAmount = races.Sum(r => r.PendingAmount),
                        RemainingAmount = Math.Max(0m, races.Sum(r => r.AllocatedFund) - races.Sum(r => r.PaidAmount) - races.Sum(r => r.PendingAmount)),
                        TotalRaceCount = races.Count,
                        PaidRaceCount = races.Count(r => r.PayoutStatus == "Paid"),
                        HasDiscrepancy = races.Any(r => r.HasDiscrepancy)
                    };
                })
                .ToList();

            var totalPaid = rounds.Sum(r => r.PaidAmount);
            var totalPending = rounds.Sum(r => r.PendingAmount);
            var totalRaceCount = rounds.Sum(r => r.TotalRaceCount);
            var totalPaidRaceCount = rounds.Sum(r => r.PaidRaceCount);

            return new TournamentPurseSummaryDto
            {
                TournamentId = tournament.TournamentId,
                TournamentName = tournament.Name,
                TournamentStatus = tournament.Status,
                TotalFund = tournament.PurseAmount,
                PaidAmount = totalPaid,
                PendingAmount = totalPending,
                // Quỹ giải KHÔNG bị trừ theo round/race khi các phần khác chưa xong —
                // remaining tính trên TOÀN BỘ tổng giải trừ đúng phần đã Paid/Unpaid thực tế.
                RemainingAmount = Math.Max(0m, tournament.PurseAmount - totalPaid - totalPending),
                TotalRaceCount = totalRaceCount,
                PaidRaceCount = totalPaidRaceCount,
                TotalRoundCount = rounds.Count,
                CompletedRoundCount = rounds.Count(r => r.RoundStatus == "Completed"),
                HasDiscrepancy = rounds.Any(r => r.HasDiscrepancy),
                Rounds = rounds
            };
        }

        // =====================================================================
        // Helper: build race-level summary DTO (dùng cho endpoint race-purse-summary)
        // =====================================================================
        private static RacePurseSummaryDto BuildRaceSummary(Race race, List<PursePayoutItemDto> items)
        {
            var paid = items.Where(i => i.PayoutStatus == "Paid").Sum(i => i.CalculatedAmount);
            var pending = items.Where(i => i.PayoutStatus == "Unpaid").Sum(i => i.CalculatedAmount);
            var (payoutStatus, hasDiscrepancy, discrepancyAmount) = DerivePayoutStatus(race.Status, race.PurseAmount, paid, pending, items.Count);

            return new RacePurseSummaryDto
            {
                RaceId = race.RaceId,
                RaceNumber = race.RaceNumber,
                RaceName = $"Race {race.RaceNumber}",
                RoundName = race.Round.Name,
                TournamentName = race.Round.Tournament.Name,
                AllocatedFund = race.PurseAmount,
                PaidAmount = paid,
                PendingAmount = pending,
                RemainingAmount = Math.Max(0m, race.PurseAmount - paid - pending),
                PayoutStatus = payoutStatus,
                ResultStatus = race.Status,
                HasDiscrepancy = hasDiscrepancy,
                DiscrepancyAmount = discrepancyAmount,
                Payouts = items
            };
        }

        // =====================================================================
        // Helper: build race-level summary ITEM (dùng cho danh sách con trong round/tournament)
        // =====================================================================
        private static RacePurseSummaryItemDto BuildRaceItem(Race race, IEnumerable<PayoutAggRow> payoutAggForRace)
        {
            decimal paid = 0m, pending = 0m;
            int count = 0;
            foreach (var row in payoutAggForRace)
            {
                count++;
                if (row.PayoutStatus == "Paid") paid += row.Amount;
                else if (row.PayoutStatus == "Unpaid") pending += row.Amount;
            }

            var (payoutStatus, hasDiscrepancy, _) = DerivePayoutStatus(race.Status, race.PurseAmount, paid, pending, count);

            return new RacePurseSummaryItemDto
            {
                RaceId = race.RaceId,
                RaceNumber = race.RaceNumber,
                AllocatedFund = race.PurseAmount,
                PaidAmount = paid,
                PendingAmount = pending,
                RemainingAmount = Math.Max(0m, race.PurseAmount - paid - pending),
                PayoutStatus = payoutStatus,
                ResultStatus = race.Status,
                HasDiscrepancy = hasDiscrepancy
            };
        }

        // =====================================================================
        // Helper: suy ra payoutStatus + cờ discrepancy dùng chung race-level
        // =====================================================================
        private static (string PayoutStatus, bool HasDiscrepancy, decimal? DiscrepancyAmount) DerivePayoutStatus(
            string raceStatus, decimal purseAmount, decimal paid, decimal pending, int payoutCount)
        {
            var overspend = paid + pending - purseAmount;
            var hasDiscrepancy = overspend > 0m;
            decimal? discrepancyAmount = hasDiscrepancy ? overspend : null;

            string payoutStatus;
            if (raceStatus == "Cancelled")
                payoutStatus = "Cancelled";
            else if (payoutCount == 0)
                payoutStatus = "NotOfficial"; // chưa Declare Official -> chưa phát sinh payout nào
            else if (pending == 0m)
                payoutStatus = "Paid";
            else
                payoutStatus = "Pending";

            return (payoutStatus, hasDiscrepancy, discrepancyAmount);
        }

        // =====================================================================
        // RBAC — Admin xem tất cả; Owner/Jockey chỉ khi có ngựa/cặp đấu trong phạm
        // vi; Spectator KHÔNG được xem (đồng bộ quyết định với ReportService —
        // dữ liệu payout không public cho Spectator).
        // =====================================================================
        private async Task EnsureTournamentAccessAsync(int tournamentId, int userId, string role)
        {
            switch (role)
            {
                case "Admin":
                    return;
                case "Owner":
                    if (!await _context.HorseTournamentEntries.AnyAsync(e => e.TournamentId == tournamentId && e.OwnerId == userId))
                        throw new UnauthorizedAccessException("Bạn không có ngựa tham gia giải đấu này.");
                    return;
                case "Jockey":
                    if (!await _context.Pairings.AnyAsync(p => p.TournamentId == tournamentId && p.JockeyId == userId))
                        throw new UnauthorizedAccessException("Bạn không có cặp đấu trong giải đấu này.");
                    return;
                default:
                    throw new UnauthorizedAccessException("Bạn không có quyền xem quỹ thưởng của giải đấu này.");
            }
        }

        private async Task EnsureRoundAccessAsync(int roundId, int userId, string role)
        {
            switch (role)
            {
                case "Admin":
                    return;
                case "Owner":
                    if (!await _context.RaceEntries.AnyAsync(e => e.Race.RoundId == roundId && e.Pairing.Horse.OwnerId == userId))
                        throw new UnauthorizedAccessException("Bạn không có ngựa tham gia vòng đấu này.");
                    return;
                case "Jockey":
                    if (!await _context.RaceEntries.AnyAsync(e => e.Race.RoundId == roundId && e.Pairing.JockeyId == userId))
                        throw new UnauthorizedAccessException("Bạn không có cặp đấu trong vòng đấu này.");
                    return;
                default:
                    throw new UnauthorizedAccessException("Bạn không có quyền xem quỹ thưởng của vòng đấu này.");
            }
        }

        private async Task EnsureRaceAccessAsync(int raceId, int userId, string role)
        {
            switch (role)
            {
                case "Admin":
                    return;
                case "Owner":
                    if (!await _context.RaceEntries.AnyAsync(e => e.RaceId == raceId && e.Pairing.Horse.OwnerId == userId))
                        throw new UnauthorizedAccessException("Bạn không có ngựa tham gia cuộc đua này.");
                    return;
                case "Jockey":
                    if (!await _context.RaceEntries.AnyAsync(e => e.RaceId == raceId && e.Pairing.JockeyId == userId))
                        throw new UnauthorizedAccessException("Bạn không có cặp đấu trong cuộc đua này.");
                    return;
                default:
                    throw new UnauthorizedAccessException("Bạn không có quyền xem quỹ thưởng của cuộc đua này.");
            }
        }

        // Kết quả GROUP BY payout theo race — chiếu sang class cụ thể thay vì
        // anonymous type để dùng lại được giữa các phương thức không cần dynamic.
        private sealed class PayoutAggRow
        {
            public int RaceId { get; set; }
            public string PayoutStatus { get; set; } = string.Empty;
            public decimal Amount { get; set; }
        }

        // =====================================================================
        // Helper: map entity -> DTO (dùng chung cho list + update)
        // =====================================================================
        private static PursePayoutItemDto MapItem(PursePayout p) => new()
        {
            PursePayoutId = p.PursePayoutId,
            RaceEntryId = p.RaceEntryId,
            RecipientUserId = p.RecipientUserId,
            RecipientName = p.RecipientUser?.FullName ?? string.Empty,
            Role = p.Role,
            FinishPosition = p.RaceEntry?.FinishPosition,
            HorseName = p.RaceEntry?.Pairing?.Horse?.Name ?? string.Empty,
            CalculatedAmount = p.CalculatedAmount,
            PayoutStatus = p.PayoutStatus,
            PaidAt = p.PaidAt,
            UpdatedByAdminId = p.UpdatedByAdminId,
            UpdatedAt = p.UpdatedAt
        };
    }
}