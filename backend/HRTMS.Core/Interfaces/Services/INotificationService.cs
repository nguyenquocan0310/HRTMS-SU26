using HRTMS.Core.DTOs.Notification;

namespace HRTMS.Core.Interfaces.Services;

public interface INotificationService
{
    // Gửi cho một người
    Task SendAsync(int recipientId, string title, string message,
                   string type = "In-app",
                   string? relatedEntityType = null, int? relatedEntityId = null);

    // Gửi cho nhiều người cùng lúc (Protest closed-loop, Emergency DQ...)
    Task SendBulkAsync(IEnumerable<int> recipientIds, string title, string message,
                       string type = "Both",
                       string? relatedEntityType = null, int? relatedEntityId = null);

    // In-app: lấy danh sách chưa đọc
    Task<IEnumerable<NotificationDto>> GetUnreadAsync(int userId);

    // Đánh dấu đã đọc
    Task MarkReadAsync(int notificationId, int userId);

    // Đánh dấu tất cả đã đọc
    Task MarkAllReadAsync(int userId);

    // Badge count cho bell icon
    Task<int> GetUnreadCountAsync(int userId);
}