using System.Text.Json;
using HRTMS.Core.DTOs.RaceEntry;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class EmergencyDisqualificationService : IEmergencyDisqualificationService
{
    private readonly HRTMSDbContext _context;

    public EmergencyDisqualificationService(HRTMSDbContext context)
    {
        _context = context;
    }

    public async Task<EmergencyDisqualificationResultDto> DisqualifyAsync(
        int actorId,
        int raceEntryId,
        string reason,
        string triggerSource,
        string? ipAddress = null,
        string? userAgent = null)
    {
        // MED.7 yeu cau atomic transaction
        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var raceEntry = await _context.RaceEntries
                .Include(e => e.Race)
                .Include(e => e.Pairing)
                    .ThenInclude(p => p.Horse)
                .Include(e => e.Pairing)
                    .ThenInclude(p => p.Jockey)
                        .ThenInclude(j => j.Jockey)
                .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);

            if (raceEntry == null)
            {
                throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");
            }

            if (raceEntry.Status == "Cancelled" || raceEntry.IsWithdrawn)
            {
                throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");
            }

            var oldStatus = raceEntry.Status;
            var now = DateTime.UtcNow;

            // 1. Cap nhat RaceEntry thanh Disqualified
            raceEntry.Status = "Disqualified";
            raceEntry.UpdatedAt = now;

            // 2. Refund cac prediction dang Pending cua RaceEntry nay
            var pendingPredictions = await _context.Predictions
                .Where(p =>
                    p.RaceEntryId == raceEntryId &&
                    p.Status == "Pending")
                .ToListAsync();

            var refundedPointsTotal = 0;

            foreach (var prediction in pendingPredictions)
            {
                var wallet = await _context.Wallets
                    .FirstOrDefaultAsync(w =>
                        w.SpectatorId == prediction.SpectatorId);

                if (wallet == null)
                {
                    throw new InvalidOperationException("WALLET_NOT_FOUND");
                }

                wallet.Balance += prediction.PointsPlaced;
                wallet.UpdatedAt = now;

                prediction.Status = "Refunded";
                prediction.PointsAwarded = 0;

                _context.VirtualPointsTransactions.Add(
                    new VirtualPointsTransaction
                    {
                        WalletId = wallet.WalletId,
                        Amount = prediction.PointsPlaced,
                        Type = "Prediction Refund",
                        ReferenceId = $"Prediction:{prediction.PredictionId}",
                        CreatedAt = now
                    });

                refundedPointsTotal += prediction.PointsPlaced;
            }

            // 3. Tao notification khan cap
            var notificationRecipients = new HashSet<int>();

            var ownerId = raceEntry.Pairing.Horse.OwnerId;
            var jockeyId = raceEntry.Pairing.JockeyId;

            notificationRecipients.Add(ownerId);
            notificationRecipients.Add(jockeyId);

            var adminIds = await _context.Users
                .Where(u => u.Role == "Admin")
                .Select(u => u.UserId)
                .ToListAsync();

            foreach (var adminId in adminIds)
            {
                notificationRecipients.Add(adminId);
            }

            // Neu DB khong co Admin thi gui them cho actor de van co nguoi nhan thong bao
            if (!notificationRecipients.Contains(actorId))
            {
                notificationRecipients.Add(actorId);
            }

            foreach (var recipientId in notificationRecipients)
            {
                _context.Notifications.Add(
                    new Notification
                    {
                        RecipientId = recipientId,
                        Title = "URGENT: Race entry disqualified",
                        Message =
                            $"RaceEntry #{raceEntryId} has been emergency disqualified. " +
                            $"Reason: {reason}",
                        Type = "In-app",
                        IsRead = false,
                        RelatedEntityType = "RaceEntry",
                        RelatedEntityId = raceEntryId,
                        SentAt = now
                    });
            }

            // 4. Ghi AuditLog
            var oldValue = JsonSerializer.Serialize(new
            {
                RaceEntryId = raceEntryId,
                Status = oldStatus
            });

            var newValue = JsonSerializer.Serialize(new
            {
                RaceEntryId = raceEntryId,
                Status = "Disqualified",
                Reason = reason,
                TriggerSource = triggerSource,
                RefundedPredictionsCount = pendingPredictions.Count,
                RefundedPointsTotal = refundedPointsTotal
            });

            _context.AuditLogs.Add(
                new AuditLog
                {
                    ActorId = actorId,
                    Action = "EmergencyDisqualification",
                    EntityName = "RaceEntry",
                    EntityId = raceEntryId.ToString(),
                    OldValue = oldValue,
                    NewValue = newValue,
                    IpAddress = ipAddress,
                    UserAgent = userAgent,
                    CreatedAt = now
                });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return new EmergencyDisqualificationResultDto
            {
                RaceEntryId = raceEntryId,
                RaceId = raceEntry.RaceId,
                OldStatus = oldStatus,
                NewStatus = raceEntry.Status,
                Reason = reason,
                TriggerSource = triggerSource,
                RefundedPredictionsCount = pendingPredictions.Count,
                RefundedPointsTotal = refundedPointsTotal,
                NotificationsCreated = notificationRecipients.Count,
                AuditLogCreated = true,
                Message = "Emergency disqualification completed successfully."
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}