using HRTMS.Core.DTOs.Medical;

namespace HRTMS.Core.Interfaces.Services;

public interface IMedicalCheckService
{
    Task<PreRaceWeightResultDto> RecordPreRaceWeightAsync(
        int doctorId,
        int raceEntryId,
        RecordPreRaceWeightDto dto);

    Task<PostRaceWeightResultDto> RecordPostRaceWeightAsync(
        int doctorId,
        int raceEntryId,
        RecordPostRaceWeightDto dto);

    Task<HorseIdentityResultDto> RecordHorseIdentityAsync(
        int doctorId,
        int raceEntryId,
        RecordHorseIdentityDto dto);
    Task<ClinicalCheckResultDto> RecordClinicalCheckAsync(
        int doctorId,
        int raceEntryId,
    RecordClinicalCheckDto dto);
    Task<List<MedicalCheckListDto>> GetRaceEntriesAsync(
        int doctorId,
        int raceId);

    Task<RaceEntryHealthProfileDto> GetRaceEntryHealthProfileAsync(
        int doctorId,
        int raceEntryId);
}
