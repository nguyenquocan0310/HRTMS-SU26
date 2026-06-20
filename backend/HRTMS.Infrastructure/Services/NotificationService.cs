using HRTMS.Core.DTOs.Notification;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly HRTMSDbContext _db;
    // Sau này inject IEmailService vào đây khi làm SMTP

    public NotificationService(HRTMSDbContext db)
    {
        _db = db;
    }

    public async Task SendAsync(int recipientId, string title, string message,
        string type = "In-app",
        string? relatedEntityType = null, int? relatedEntityId = null)
    {
        var notification = new Notification
        {
            RecipientId = recipientId,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            SentAt = DateTime.UtcNow
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();

        // TODO: nếu type == "Email" || "Both" → gọi IEmailService.SendAsync(...)
    }

    public async Task SendBulkAsync(IEnumerable<int> recipientIds, string title, string message,
        string type = "Both",
        string? relatedEntityType = null, int? relatedEntityId = null)
    {
        var notifications = recipientIds.Select(id => new Notification
        {
            RecipientId = id,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            SentAt = DateTime.UtcNow
        });

        _db.Notifications.AddRange(notifications);
        await _db.SaveChangesAsync();
    }

    public async Task<IEnumerable<NotificationDto>> GetUnreadAsync(int userId)
    {
        return await _db.Notifications
            .Where(n => n.RecipientId == userId && !n.IsRead)
            .OrderByDescending(n => n.SentAt)
            .Select(n => new NotificationDto
            {
                NotificationId = n.NotificationId,
                Title = n.Title,
                Message = n.Message,
                Type = n.Type,
                IsRead = n.IsRead,
                RelatedEntityType = n.RelatedEntityType,
                RelatedEntityId = n.RelatedEntityId,
                SentAt = n.SentAt
            })
            .ToListAsync();
    }

    public async Task MarkReadAsync(int notificationId, int userId)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.NotificationId == notificationId
                                   && n.RecipientId == userId);
        if (notification is null) return;

        notification.IsRead = true;
        notification.ReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task MarkAllReadAsync(int userId)
    {
        await _db.Notifications
            .Where(n => n.RecipientId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s
                .SetProperty(n => n.IsRead, true)
                .SetProperty(n => n.ReadAt, DateTime.UtcNow));
    }

    public async Task<int> GetUnreadCountAsync(int userId)
    {
        return await _db.Notifications
            .CountAsync(n => n.RecipientId == userId && !n.IsRead);
    }
}