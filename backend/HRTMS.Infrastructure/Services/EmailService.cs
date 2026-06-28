using HRTMS.Core.Interfaces.Services;
using HRTMS.Core.Models;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace HRTMS.Infrastructure.Services;

/// <summary>
/// NOTI.2 — SMTP email service dùng MailKit.
/// Lỗi SMTP chỉ được LOG, không throw, để bảo vệ in-app notification.
/// </summary>
public class EmailService : IEmailService
{
    private readonly SmtpSettings _smtp;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<SmtpSettings> smtp, ILogger<EmailService> logger)
    {
        _smtp = smtp.Value;
        _logger = logger;
    }

    public async Task SendAsync(string toEmail, string toName, string subject, string htmlBody)
    {
        try
        {
            var message = BuildMessage([(toEmail, toName)], subject, htmlBody);
            await SendMessageAsync(message);
        }
        catch (Exception ex)
        {
            // NOTI.2: SMTP lỗi KHÔNG làm mất in-app — chỉ log
            _logger.LogError(ex, "SMTP failed: to={Email}, subject={Subject}", toEmail, subject);
        }
    }

    public async Task SendBulkAsync(
        IEnumerable<(string Email, string Name)> recipients,
        string subject, string htmlBody)
    {
        try
        {
            var list = recipients.ToList();
            if (list.Count == 0) return;

            var message = BuildMessage(list, subject, htmlBody);
            await SendMessageAsync(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP bulk failed: subject={Subject}", subject);
        }
    }

    private MimeMessage BuildMessage(
        IEnumerable<(string Email, string Name)> recipients,
        string subject, string htmlBody)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_smtp.FromName, _smtp.FromEmail));

        foreach (var (email, name) in recipients)
            message.To.Add(new MailboxAddress(name, email));

        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();
        return message;
    }

    private async Task SendMessageAsync(MimeMessage message)
    {
        using var client = new SmtpClient();

        var secureOption = _smtp.UseSsl
            ? SecureSocketOptions.StartTls
            : SecureSocketOptions.None;

        await client.ConnectAsync(_smtp.Host, _smtp.Port, secureOption);
        await client.AuthenticateAsync(_smtp.Username, _smtp.Password);
        await client.SendAsync(message);
        await client.DisconnectAsync(quit: true);
    }
}