namespace HRTMS.Core.Interfaces.Services;

/// <summary>
/// NOTI.2 — Gửi email qua SMTP. Lỗi SMTP không được throw ra ngoài
/// (chỉ log) để tránh làm mất bản ghi in-app notification.
/// </summary>
public interface IEmailService
{
    Task SendAsync(string toEmail, string toName, string subject, string htmlBody);
    Task SendBulkAsync(IEnumerable<(string Email, string Name)> recipients, string subject, string htmlBody);
}