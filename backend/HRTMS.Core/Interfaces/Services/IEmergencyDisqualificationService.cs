using HRTMS.Core.DTOs.RaceEntry;

namespace HRTMS.Core.Interfaces.Services;

public interface IEmergencyDisqualificationService
{
    Task<EmergencyDisqualificationResultDto> DisqualifyAsync(
        int actorId,
        int raceEntryId,
        string reason,
        string triggerSource,
        string? ipAddress = null,
        string? userAgent = null);
}