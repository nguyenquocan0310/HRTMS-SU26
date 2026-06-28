using HRTMS.Core.DTOs.Notification;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRTMS.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly HRTMSDbContext _db;
    private readonly IEmailService _emailService;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        HRTMSDbContext db,
        IEmailService emailService,
        ILogger<NotificationService> logger)
    {
        _db = db;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// NOTI.2 — Gửi notification 2 kênh.
    /// type: "In-app" | "Email" | "Both"
    /// SMTP lỗi sẽ chỉ log, KHÔNG mất bản ghi in-app.
    /// </summary>
    public async Task SendAsync(
        int recipientId, string title, string message,
        string type = "In-app",
        string? relatedEntityType = null, int? relatedEntityId = null)
    {
        // Luôn lưu in-app trước
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

        // NOTI.2 — gửi email nếu type là Email hoặc Both
        if (type is "Email" or "Both")
        {
            var user = await _db.Users
                .AsNoTracking()
                .Where(u => u.UserId == recipientId)
                .Select(u => new { u.Email, u.FullName })
                .FirstOrDefaultAsync();

            if (user != null)
            {
                var html = BuildEmailHtml(title, message);
                await _emailService.SendAsync(user.Email, user.FullName, title, html);
            }
        }
    }

    public async Task SendBulkAsync(
        IEnumerable<int> recipientIds, string title, string message,
        string type = "Both",
        string? relatedEntityType = null, int? relatedEntityId = null)
    {
        var idList = recipientIds.ToList();
        if (idList.Count == 0) return;

        var notifications = idList.Select(id => new Notification
        {
            RecipientId = id,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            SentAt = DateTime.UtcNow
        }).ToList();

        _db.Notifications.AddRange(notifications);
        await _db.SaveChangesAsync();

        // NOTI.2 — gửi email bulk
        if (type is "Email" or "Both")
        {
            var users = await _db.Users
                .AsNoTracking()
                .Where(u => idList.Contains(u.UserId))
                .Select(u => new { u.Email, u.FullName })
                .ToListAsync();

            if (users.Count > 0)
            {
                var html = BuildEmailHtml(title, message);
                await _emailService.SendBulkAsync(
                    users.Select(u => (u.Email, u.FullName)),
                    title, html);
            }
        }
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

    // ── Email template tối giản ──────────────────────────────────────────────
    private static string BuildEmailHtml(string title, string message) => $"""
        <!DOCTYPE html>
        <html>
        <body style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
          <h2 style="color:#1a56db">{System.Net.WebUtility.HtmlEncode(title)}</h2>
          <p style="font-size:15px;line-height:1.6">{System.Net.WebUtility.HtmlEncode(message)}</p>
          <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
          <p style="font-size:12px;color:#6b7280">
            Email này được gửi tự động từ hệ thống HRTMS. Vui lòng không trả lời.
          </p>
        </body>
        </html>
        """;
}