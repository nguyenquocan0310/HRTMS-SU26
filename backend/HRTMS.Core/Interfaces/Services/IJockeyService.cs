using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Jockey;


namespace HRTMS.Core.Interfaces.Services;

public interface IJockeyService
{
    Task<JockeyProfileDto?> GetProfileAsync(int jockeyId);

    Task<JockeyProfileDto?> UpdateProfileAsync(
        int jockeyId,
        UpdateJockeyProfileDto dto);

    Task<PagedResult<AvailableJockeyDto>> GetAvailableAsync(
        int ownerId,
        int tournamentId,
        int page,
        int pageSize);

    Task<PagedResult<JockeyInvitationDto>> GetInvitationsAsync(
        int jockeyId,
        string? status,
        int page,
        int pageSize);
    
}