using HRTMS.Core.DTOs.Notification;

namespace HRTMS.Core.Interfaces.Services;

public interface INotificationService
{
    Task SendAsync(int recipientId, string title, string message,
                   string type = "In-app",
                   string? relatedEntityType = null, int? relatedEntityId = null);

    Task SendBulkAsync(IEnumerable<int> recipientIds, string title, string message,
                       string type = "Both",
                       string? relatedEntityType = null, int? relatedEntityId = null);

    Task<IEnumerable<NotificationDto>> GetUnreadAsync(int userId);

    Task<IEnumerable<NotificationDto>> GetAllAsync(int userId, int page = 1, int pageSize = 20); // ← thêm dòng này

    Task MarkReadAsync(int notificationId, int userId);

    Task MarkAllReadAsync(int userId);

    Task<int> GetUnreadCountAsync(int userId);
}