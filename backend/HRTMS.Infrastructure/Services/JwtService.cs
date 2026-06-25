using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HRTMS.Core.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace HRTMS.Infrastructure.Services;

public class JwtService
{
    private readonly IConfiguration _config;

    public JwtService(IConfiguration config)
    {
        _config = config;
    }

    public string GenerateToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["JwtSettings:SecretKey"]!));

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: _config["JwtSettings:Issuer"],
            audience: _config["JwtSettings:Audience"],
            claims: claims,
            // notBefore buộc thư viện ghi `iat` (IssuedAt) vào JWT payload.
            // Thiếu notBefore → JwtSecurityToken.IssuedAt == DateTime.MinValue
            // → TokenBlacklistMiddleware.ExtractIssuedAt trả null
            // → không thể so sánh với blacklistedSince → token cũ sau Logout/Suspend
            // vẫn được chấp nhận trong window còn sống (EC-29 bị phá vỡ).
            notBefore: now,
            expires: now.AddMinutes(int.Parse(_config["JwtSettings:ExpiryMinutes"]!)),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}