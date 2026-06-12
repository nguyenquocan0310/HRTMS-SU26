using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class AuditLog
{
    public int AuditLogId { get; set; }

    public int ActorId { get; set; }

    public string Action { get; set; } = null!;

    public string EntityName { get; set; } = null!;

    public string EntityId { get; set; } = null!;

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User Actor { get; set; } = null!;
}
