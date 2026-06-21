namespace HRTMS.Core.DTOs.RaceEntry;

public class EmergencyDisqualificationResultDto
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public string OldStatus { get; set; } = null!;

    public string NewStatus { get; set; } = null!;

    public string Reason { get; set; } = null!;

    public string TriggerSource { get; set; } = null!;

    public int RefundedPredictionsCount { get; set; }

    public int RefundedPointsTotal { get; set; }

    public int NotificationsCreated { get; set; }

    public bool AuditLogCreated { get; set; }

    public string Message { get; set; } = null!;
}