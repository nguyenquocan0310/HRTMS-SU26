using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Auth;

// REQ-F-ACC.3 — Cập nhật FullName và Email
public class UpdateBasicInfoDto
{
    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(100)]
    public string Email { get; set; } = string.Empty;
}

// REQ-F-ACC.3 — Đổi mật khẩu
public class ChangePasswordDto
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}