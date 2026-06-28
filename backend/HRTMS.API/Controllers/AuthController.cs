using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IProfileService _profileService;

    public AuthController(IAuthService authService, IProfileService profileService)
    {
        _authService = authService;
        _profileService = profileService;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private string? ClientIp =>
        HttpContext.Connection.RemoteIpAddress?.ToString();

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        var ip = ClientIp;
        var result = await _authService.RegisterAsync(dto, ip);
        if (!result.Success)
        {
            var isConflict = result.Message?.Contains("tồn tại") == true;
            return isConflict ? Conflict(result) : BadRequest(result);
        }
        return Created("", result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var result = await _authService.LoginAsync(dto, ClientIp);
        return result.Success ? Ok(result) : Unauthorized(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var result = await _authService.LogoutAsync(CurrentUserId, ClientIp);
        return Ok(result);
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var username = User.FindFirstValue(ClaimTypes.Name);
        var role = User.FindFirstValue(ClaimTypes.Role);
        return Ok(new { userId, username, role });
    }

    /// <summary>ACC.3 — Lấy profile đầy đủ của user hiện tại</summary>
    [HttpGet("profile")]
    [Authorize]
    public async Task<IActionResult> GetProfile()
    {
        var result = await _profileService.GetProfileAsync(CurrentUserId);
        return result.Success ? Ok(result) : NotFound(result);
    }

    /// <summary>ACC.3 — Cập nhật FullName và Email</summary>
    [HttpPatch("me")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateBasicInfoDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await _profileService.UpdateBasicInfoAsync(CurrentUserId, dto, ClientIp);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>ACC.3 — Đổi mật khẩu (yêu cầu mật khẩu hiện tại)</summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await _profileService.ChangePasswordAsync(CurrentUserId, dto, ClientIp);
        return result.Success ? Ok(result) : BadRequest(result);
    }
}