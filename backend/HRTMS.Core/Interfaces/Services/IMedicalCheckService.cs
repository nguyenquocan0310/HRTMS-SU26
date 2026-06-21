using HRTMS.Core.DTOs.Medical;

namespace HRTMS.Core.Interfaces.Services;

public interface IMedicalCheckService
{
    // Doctor ghi can nang Jockey truoc dua
    Task<PreRaceWeightResultDto> RecordPreRaceWeightAsync(
        int doctorId,
        int raceEntryId,
        RecordPreRaceWeightDto dto);
}