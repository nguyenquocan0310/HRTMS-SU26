namespace HRTMS.Core.Interfaces.Services;

public interface IAuditLogService
{
    Task LogAsync(int actorId, string action, string entityName,
                  string entityId, string? oldValue = null,
                  string? newValue = null, string? ipAddress = null,
                  string? userAgent = null);

    void LogDeferred(int actorId, string action, string entityName,
                     string entityId, string? oldValue = null,
                     string? newValue = null, string? ipAddress = null,
                     string? userAgent = null);
}