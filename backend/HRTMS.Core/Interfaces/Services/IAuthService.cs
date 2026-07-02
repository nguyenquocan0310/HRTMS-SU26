using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;

namespace HRTMS.Core.Interfaces.Services;

public interface IAuthService
{
    Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto dto, string? ipAddress, string? userAgent = null);
    Task<ApiResponse<int>> RegisterAsync(RegisterDto dto, string? ipAddress, string? userAgent = null);
    Task<ApiResponse<bool>> LogoutAsync(int userId, string? ipAddress, string? userAgent = null);

    /// <summary>ACC.2 — Admin tạo tài khoản cho bất kỳ role nào kể cả Admin</summary>
    Task<ApiResponse<int>> AdminCreateUserAsync(AdminCreateUserDto dto, int adminId, string? ipAddress, string? userAgent = null);

    /// <summary>PWD.1 — Gửi email chứa reset token (JWT 15 phút)</summary>
    Task<ApiResponse<bool>> ForgotPasswordAsync(ForgotPasswordDto dto);

    /// <summary>PWD.2 — Verify reset token và đổi mật khẩu mới</summary>
    Task<ApiResponse<bool>> ResetPasswordAsync(ResetPasswordDto dto);
}