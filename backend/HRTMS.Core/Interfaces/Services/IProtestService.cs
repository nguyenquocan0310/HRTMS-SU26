using HRTMS.Core.DTOs.Protest;

namespace HRTMS.Core.Interfaces.Services;

public interface IProtestService
{
    Task<ProtestDto> SubmitAsync(int submitterUserId, SubmitProtestDto dto);
    Task<ProtestRulingResultDto> RuleAsync(int refereeId, int protestId, RuleProtestDto dto);
    Task CloseWindowEarlyAsync(int raceId, int refereeId);
    Task<IReadOnlyList<ProtestDto>> GetByRaceAsync(int raceId);
}