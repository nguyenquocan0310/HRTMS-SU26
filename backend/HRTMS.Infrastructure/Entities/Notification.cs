using System;
using System.Collections.Generic;

namespace HRTMS.Infrastructure.Entities;

public partial class Notification
{
    public int NotificationId { get; set; }

    public int RecipientId { get; set; }

    public string Title { get; set; } = null!;

    public string Message { get; set; } = null!;

    public string Type { get; set; } = null!;

    public bool IsRead { get; set; }

    public string? RelatedEntityType { get; set; }

    public int? RelatedEntityId { get; set; }

    public DateTime SentAt { get; set; }

    public DateTime? ReadAt { get; set; }

    public virtual User Recipient { get; set; } = null!;
}
