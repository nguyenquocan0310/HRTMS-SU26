using HRTMS.Core.DTOs.Referee;

namespace HRTMS.Core.Interfaces.Services;

public interface IIndependenceCheckService
{
    Task<IndependenceCheckResultDto> CheckJockeyIndependenceAsync(
        int refereeId,
        int raceEntryId);
}