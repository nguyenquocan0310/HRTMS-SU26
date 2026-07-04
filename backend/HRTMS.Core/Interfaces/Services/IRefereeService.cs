using HRTMS.Core.DTOs.Referee;

namespace HRTMS.Core.Interfaces.Services;

public interface IRefereeService
{
    Task<RefereeProfileDto?> GetProfileAsync(int refereeId);

    Task<RefereeProfileDto?> UpdateProfileAsync(int refereeId, UpdateRefereeProfileDto dto);
}