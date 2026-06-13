using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly HRTMSDbContext _context;
    private readonly JwtService _jwtService;

    public AuthService(HRTMSDbContext context, JwtService jwtService)
    {
        _context = context;
        _jwtService = jwtService;
    }

    public async Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return ApiResponse<AuthResponseDto>.Fail("Email hoặc mật khẩu không đúng.");

        if (user.Status == "Pending")
            return ApiResponse<AuthResponseDto>.Fail("Tài khoản chưa được kích hoạt.");

        if (user.Status == "Suspended")
            return ApiResponse<AuthResponseDto>.Fail("Tài khoản đã bị vô hiệu hóa.");

        var token = _jwtService.GenerateToken(user);

        return ApiResponse<AuthResponseDto>.Ok(new AuthResponseDto
        {
            Token = token,
            UserId = user.UserId,
            Role = user.Role,
            FullName = user.FullName
        });
    }

    public async Task<ApiResponse<int>> RegisterAsync(RegisterDto dto)
    {
        if (await _context.Users.AnyAsync(u => u.Email == dto.Email || u.Username == dto.Username))
            return ApiResponse<int>.Fail("Email hoặc Username đã tồn tại.");

        string initialStatus = dto.Role is "Admin" or "Spectator" or "Owner"
            ? "Active" : "Pending";

        var user = new User
        {
            Username = dto.Username,
            FullName = dto.FullName,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Role = dto.Role,
            Status = initialStatus,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return ApiResponse<int>.Ok(user.UserId, "Tạo tài khoản thành công.");
    }
}
