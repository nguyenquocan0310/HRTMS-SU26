using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;

namespace HRTMS.Core.Interfaces.Services;


public interface IAuthService
{
    Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto dto, string? ipAddress);
    Task<ApiResponse<int>> RegisterAsync(RegisterDto dto, string? ipAddress);
    Task<ApiResponse<bool>> LogoutAsync(int userId, string? ipAddress);
}