using HRTMS.Core.DTOs.Referee;

namespace HRTMS.Core.Interfaces.Services;

public interface IRefereeAssignmentService
{
    // Admin gan Referee vao mot Race
    Task<RefereeAssignmentDto> AssignAsync(
        int raceId,
        AssignRefereeDto dto);

    // Lay danh sach Referee da duoc gan vao mot Race
    Task<List<RefereeAssignmentDto>> GetByRaceAsync(
        int raceId);

    // Admin go Referee khoi mot Race
    Task RemoveAsync(
        int raceId,
        int refereeId);
}