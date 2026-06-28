using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;

namespace HRTMS.Core.Interfaces.Services;

public interface IAuthService
{
    Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto dto, string? ipAddress);
    Task<ApiResponse<int>> RegisterAsync(RegisterDto dto, string? ipAddress);
    Task<ApiResponse<bool>> LogoutAsync(int userId, string? ipAddress);

    /// <summary>ACC.2 — Admin tạo tài khoản cho bất kỳ role nào kể cả Admin</summary>
    Task<ApiResponse<int>> AdminCreateUserAsync(AdminCreateUserDto dto, int adminId, string? ipAddress);
}