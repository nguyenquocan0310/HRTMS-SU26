using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;

namespace HRTMS.Infrastructure.Services;

public class AuditLogService : IAuditLogService
{
    private readonly HRTMSDbContext _context;

    public AuditLogService(HRTMSDbContext context) => _context = context;

    public async Task LogAsync(int actorId, string action, string entityName,
        string entityId, string? oldValue = null,
        string? newValue = null, string? ipAddress = null)
    {
        _context.AuditLogs.Add(new AuditLog
        {
            ActorId = actorId,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            OldValue = oldValue,
            NewValue = newValue,
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
    }

    public void LogDeferred(int actorId, string action, string entityName,
        string entityId, string? oldValue = null,
        string? newValue = null, string? ipAddress = null)
    {
        _context.AuditLogs.Add(new AuditLog
        {
            ActorId = actorId,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            OldValue = oldValue,
            NewValue = newValue,
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow
        });
        // Không SaveChanges — caller trong transaction lớn tự save
    }
}