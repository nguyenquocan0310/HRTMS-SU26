using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;

namespace HRTMS.Core.Interfaces.Services;

public interface IProfileService
{
	Task<ApiResponse<UserProfileDto>> GetProfileAsync(int userId);
}