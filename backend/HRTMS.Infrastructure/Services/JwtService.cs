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

        var now = DateTime.UtcNow;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            // iat (Issued At) — BẮT BUỘC cho TokenBlacklistMiddleware (EC-29)
            // So sánh thời điểm phát token với mốc blacklist. Thiếu iat thì
            // mọi token bị coi là "cũ" và bị chặn 401 sau khi user từng logout.
            new Claim(JwtRegisteredClaimNames.Iat,
                new DateTimeOffset(now).ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64)
        };

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