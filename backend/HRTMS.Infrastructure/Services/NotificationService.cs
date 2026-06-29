using HRTMS.Core.DTOs.Notification;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRTMS.Infrastructure.Services;

/// <summary>
/// NOTI — Notification service: in-app + SMTP email (NOTI.2).
///
/// Nguyên tắc:
///   1. In-app luôn lưu trước — SMTP lỗi không mất bản ghi in-app.
///   2. type "In-app"  → chỉ lưu DB.
///      type "Email"   → chỉ gửi email (vẫn lưu DB để audit).
///      type "Both"    → lưu DB + gửi email.
///   3. SMTP lỗi chỉ log, không throw.
/// </summary>
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

    // ── Gửi cho 1 người ─────────────────────────────────────────────────────

    public async Task SendAsync(
        int recipientId, string title, string message,
        string type = "In-app",
        string? relatedEntityType = null, int? relatedEntityId = null)
    {
        // Lưu in-app trước — bảo vệ khỏi SMTP failure
        _db.Notifications.Add(new Notification
        {
            RecipientId = recipientId,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            SentAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        // NOTI.2 — gửi email nếu cần
        if (type is "Email" or "Both")
            await SendEmailToUserAsync(recipientId, title, message);
    }

    // ── Gửi cho nhiều người ─────────────────────────────────────────────────

    public async Task SendBulkAsync(
        IEnumerable<int> recipientIds, string title, string message,
        string type = "Both",
        string? relatedEntityType = null, int? relatedEntityId = null)
    {
        var idList = recipientIds.Distinct().ToList();
        if (idList.Count == 0) return;

        var now = DateTime.UtcNow;
        _db.Notifications.AddRange(idList.Select(id => new Notification
        {
            RecipientId = id,
            Title = title,
            Message = message,
            Type = type,
            IsRead = false,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            SentAt = now
        }));
        await _db.SaveChangesAsync();

        // NOTI.2 — gửi email bulk
        if (type is "Email" or "Both")
            await SendEmailToUsersAsync(idList, title, message);
    }

    // ── Đọc notification ────────────────────────────────────────────────────

    public async Task<IEnumerable<NotificationDto>> GetUnreadAsync(int userId) =>
        await _db.Notifications
            .Where(n => n.RecipientId == userId && !n.IsRead)
            .OrderByDescending(n => n.SentAt)
            .Select(ToDto)
            .ToListAsync();

    public async Task<IEnumerable<NotificationDto>> GetAllAsync(
        int userId, int page = 1, int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        return await _db.Notifications
            .Where(n => n.RecipientId == userId)
            .OrderByDescending(n => n.SentAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToDto)
            .ToListAsync();
    }

    // ── Đánh dấu đọc ────────────────────────────────────────────────────────

    public async Task MarkReadAsync(int notificationId, int userId)
    {
        var n = await _db.Notifications
            .FirstOrDefaultAsync(x => x.NotificationId == notificationId
                                   && x.RecipientId == userId);
        if (n is null || n.IsRead) return;

        n.IsRead = true;
        n.ReadAt = DateTime.UtcNow;
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

    public async Task<int> GetUnreadCountAsync(int userId) =>
        await _db.Notifications.CountAsync(n => n.RecipientId == userId && !n.IsRead);

    // ── Private helpers ──────────────────────────────────────────────────────

    private async Task SendEmailToUserAsync(int userId, string title, string message)
    {
        var user = await _db.Users
            .AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => new { u.Email, u.FullName })
            .FirstOrDefaultAsync();

        if (user is null)
        {
            _logger.LogWarning("SendEmailToUser: userId={UserId} không tồn tại", userId);
            return;
        }

        await _emailService.SendAsync(
            user.Email, user.FullName ?? user.Email,
            title, BuildEmailHtml(title, message));
    }

    private async Task SendEmailToUsersAsync(
        List<int> userIds, string title, string message)
    {
        var users = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.UserId))
            .Select(u => new { u.Email, u.FullName })
            .ToListAsync();

        if (users.Count == 0) return;

        await _emailService.SendBulkAsync(
            users.Select(u => (u.Email, u.FullName ?? u.Email)),
            title, BuildEmailHtml(title, message));
    }

    private static System.Linq.Expressions.Expression<Func<Notification, NotificationDto>> ToDto =>
        n => new NotificationDto
        {
            NotificationId = n.NotificationId,
            Title = n.Title,
            Message = n.Message,
            Type = n.Type,
            IsRead = n.IsRead,
            RelatedEntityType = n.RelatedEntityType,
            RelatedEntityId = n.RelatedEntityId,
            SentAt = n.SentAt
        };

    // HTML template cho email — đơn giản, không bị clip Gmail
    private static string BuildEmailHtml(string title, string message)
    {
        var safeTitle = System.Net.WebUtility.HtmlEncode(title);
        var safeMessage = System.Net.WebUtility.HtmlEncode(message)
                              .Replace("\n", "<br/>");
        return $"""
            <!DOCTYPE html>
            <html lang="vi">
            <body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#1f2937">
              <div style="border-left:4px solid #1a56db;padding-left:16px;margin-bottom:20px">
                <h2 style="margin:0;color:#1a56db;font-size:18px">{safeTitle}</h2>
              </div>
              <p style="font-size:15px;line-height:1.7;margin-bottom:24px">{safeMessage}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
              <p style="font-size:12px;color:#9ca3af;margin:0">
                Email này được gửi tự động từ hệ thống HRTMS. Vui lòng không trả lời email này.
              </p>
            </body>
            </html>
            """;
    }
}