using HRTMS.Core.DTOs.Doctor;
using HRTMS.Core.DTOs.Assignment;

namespace HRTMS.Core.Interfaces.Services;

public interface IDoctorAssignmentService
{
    Task<DoctorAssignmentDto> AssignAsync(
        int raceId,
        AssignDoctorDto dto);

    Task<List<DoctorAssignmentDto>> GetByRaceAsync(
        int raceId);

    Task RemoveAsync(
        int raceId,
        int doctorId);

    Task<List<MyRaceAssignmentDto>> GetMyAssignmentsAsync(
        int doctorId);
}