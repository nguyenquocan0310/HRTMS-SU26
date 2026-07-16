using HRTMS.Core.DTOs.RaceEntry;

namespace HRTMS.Core.Interfaces.Services;

public interface IStartingListService
{
    Task<List<StartingListEntryDto>> GetRaceEntriesAsync(
        int refereeId,
        int raceId);

    Task<ConfirmStartingListResultDto> ConfirmStartingListAsync(
        int refereeId,
        int raceId);
}
