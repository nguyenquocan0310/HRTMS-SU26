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
        // REQ-F-PRZ.6 + PRZ.4 — Bảng phân bổ Purse + dòng Remainder của 1 cuộc đua
        // =====================================================================
        public async Task<RacePayoutSummaryDto> GetRacePayoutsAsync(int raceId)
        {
            var race = await _context.Races
                .Include(r => r.Round).ThenInclude(rd => rd.Tournament)
                .FirstOrDefaultAsync(r => r.RaceId == raceId)
                ?? throw new KeyNotFoundException($"Không tìm thấy Race #{raceId}");

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
                RemainderAmount = race.PurseAmount - totalAllocated,
                Payouts = items
            };
        }

        // =====================================================================
        // REQ-F-PRZ.6 — Đổi trạng thái Paid/Unpaid + ghi AuditLog (AC#1)
        // =====================================================================
        public async Task<PursePayoutItemDto> UpdatePayoutStatusAsync(
            int payoutId, MarkPayoutStatusDto dto, int adminUserId)
        {
            var newStatus = (dto.PayoutStatus ?? string.Empty).Trim();
            if (!ValidStatuses.Contains(newStatus))
                throw new ArgumentException("PayoutStatus chỉ nhận 'Paid' hoặc 'Unpaid'");

            var payout = await _context.PursePayouts
                .Include(p => p.RecipientUser)
                .Include(p => p.RaceEntry).ThenInclude(re => re.Pairing).ThenInclude(pa => pa.Horse)
                .FirstOrDefaultAsync(p => p.PursePayoutId == payoutId)
                ?? throw new KeyNotFoundException($"Không tìm thấy PursePayout #{payoutId}");

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
                action: "Update_Payout_Status",
                entityName: "PursePayout",
                entityId: payout.PursePayoutId.ToString(),
                oldValue: oldStatus,
                newValue: newStatus
            );

            return MapItem(payout);
        }

        // =====================================================================
        // REQ-F-PRZ.6 — Lịch sử thưởng tích lũy theo người nhận (Owner/Jockey)
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
        // REQ-F-PRZ.6 — Owner tự xem tiền thưởng của mình (self-scoped)
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