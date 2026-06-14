using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using System.Text.Json;
using HRTMS.Core.Common;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.API.Middleware;

/// <summary>
/// EC-29: Kiểm tra mỗi request xem token có bị blacklist không,
/// và user có đang bị Suspended không — dù JWT vẫn còn hạn.
/// </summary>
public class TokenBlacklistMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TokenBlacklistMiddleware> _logger;

    public TokenBlacklistMiddleware(RequestDelegate next,
        ILogger<TokenBlacklistMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context,
        ITokenBlacklistService blacklistService,
        HRTMSDbContext db)
    {
        // Chỉ kiểm tra khi request có Authorization header
        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (authHeader != null && authHeader.StartsWith("Bearer "))
        {
            var token = authHeader["Bearer ".Length..];
            var userId = ExtractUserId(token);

            if (userId.HasValue)
            {
                // 1. Kiểm tra blacklist Redis (EC-29)
                var blacklistedSince = await blacklistService.GetBlacklistedSinceAsync(userId.Value);
                if (blacklistedSince.HasValue)
                {
                    var issuedAt = ExtractIssuedAt(token);
                    if (issuedAt == null || issuedAt.Value <= blacklistedSince.Value)
                    {
                        _logger.LogWarning(
                            "Blocked blacklisted token for userId={UserId}", userId.Value);
                        await WriteUnauthorized(context, "Phiên đăng nhập đã hết hiệu lực.");
                        return;
                    }
                }

                // 2. Kiểm tra User.Status trong DB (phòng trường hợp Redis hết TTL)
                var userStatus = await db.Users
                    .Where(u => u.UserId == userId.Value)
                    .Select(u => u.Status)
                    .FirstOrDefaultAsync();

                if (userStatus == "Suspended")
                {
                    _logger.LogWarning(
                        "Blocked suspended user userId={UserId}", userId.Value);
                    await WriteUnauthorized(context, "Tài khoản đã bị vô hiệu hóa.");
                    return;
                }
            }
        }

        await _next(context);
    }

    // Lấy UserId từ claim NameIdentifier trong JWT (không validate signature ở đây —
    // UseAuthentication() đã làm điều đó trước middleware này)
    private static int? ExtractUserId(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            if (!handler.CanReadToken(token)) return null;
            var jwt = handler.ReadJwtToken(token);
            var sub = jwt.Claims.FirstOrDefault(c =>
                c.Type is ClaimTypes.NameIdentifier or "nameid" or "sub")?.Value;
            return int.TryParse(sub, out var id) ? id : null;
        }
        catch
        {
            return null;
        }
    }

    // Lấy thời điểm token được cấp (claim "iat")
    private static DateTime? ExtractIssuedAt(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            return jwt.IssuedAt == DateTime.MinValue ? null : jwt.IssuedAt.ToUniversalTime();
        }
        catch
        {
            return null;
        }
    }

    private static Task WriteUnauthorized(HttpContext context, string message)
    {
        context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
        context.Response.ContentType = "application/json";
        var body = JsonSerializer.Serialize(ApiResponse<object>.Fail(message));
        return context.Response.WriteAsync(body);
    }
}
