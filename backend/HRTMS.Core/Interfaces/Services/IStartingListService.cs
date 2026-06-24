using HRTMS.Core.DTOs.RaceEntry;

namespace HRTMS.Core.Interfaces.Services;

public interface IStartingListService
{
    Task<ConfirmStartingListResultDto> ConfirmStartingListAsync(
        int refereeId,
        int raceId);
}