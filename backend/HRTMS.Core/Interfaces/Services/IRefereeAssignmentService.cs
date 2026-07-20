using HRTMS.Core.DTOs.Referee;
using HRTMS.Core.DTOs.Assignment;

namespace HRTMS.Core.Interfaces.Services;

public interface IRefereeAssignmentService
{
    // Admin gan Referee vao mot Race
    Task<RefereeAssignmentDto> AssignAsync(
        int raceId,
        AssignRefereeDto dto,
        int adminUserId);

    // Lay danh sach Referee da duoc gan vao mot Race
    Task<List<RefereeAssignmentDto>> GetByRaceAsync(
        int raceId);

    // Admin go Referee khoi mot Race
    Task RemoveAsync(
        int raceId,
        int refereeId,
        int adminUserId);

    // Referee xem cac Race minh duoc phan cong
    Task<List<MyRaceAssignmentDto>> GetMyAssignmentsAsync(
        int refereeId);
}