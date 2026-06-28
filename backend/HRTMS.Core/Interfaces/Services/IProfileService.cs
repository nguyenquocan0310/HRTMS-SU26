using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;

namespace HRTMS.Core.Interfaces.Services;

public interface IProfileService
{
    Task<ApiResponse<UserProfileDto>> GetProfileAsync(int userId);

    /// <summary>ACC.3 — Cập nhật FullName và Email</summary>
    Task<ApiResponse<bool>> UpdateBasicInfoAsync(int userId, UpdateBasicInfoDto dto, string? ipAddress);

    /// <summary>ACC.3 — Đổi mật khẩu (xác thực mật khẩu hiện tại)</summary>
    Task<ApiResponse<bool>> ChangePasswordAsync(int userId, ChangePasswordDto dto, string? ipAddress);
}