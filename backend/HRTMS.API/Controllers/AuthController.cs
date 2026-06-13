using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HRTMS.API.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Entities;

namespace HRTMS.API.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly HRTMSDbContext _context;
        private readonly JwtService _jwtService;

        public AuthController(HRTMSDbContext context, JwtService jwtService)
        {
            _context = context;
            _jwtService = jwtService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email || u.Username == request.Username))
                return Conflict(new { message = "Email hoặc Username đã tồn tại." });

            string initialStatus = request.Role is "Admin" or "Spectator" or "Owner"
                ? "Active" : "Pending";

            var user = new User
            {
                Username = request.Username,
                FullName = request.FullName,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.Role,
                Status = initialStatus,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Created("", new { userId = user.UserId, message = "Tạo tài khoản thành công." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });

            if (user.Status == "Pending")
                return Unauthorized(new { message = "Tài khoản chưa được kích hoạt." });

            if (user.Status == "Suspended")
                return Unauthorized(new { message = "Tài khoản đã bị vô hiệu hóa." });

            var token = _jwtService.GenerateToken(user);

            return Ok(new
            {
                token,
                userId = user.UserId,
                role = user.Role,
                fullName = user.FullName
            });
        }
    }

    public record RegisterRequest(string Username, string FullName, string Email, string Password, string Role);
    public record LoginRequest(string Email, string Password);
}