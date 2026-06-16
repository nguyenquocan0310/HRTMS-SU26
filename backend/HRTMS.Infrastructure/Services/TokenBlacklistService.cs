using HRTMS.Core.Interfaces.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HRTMS.Infrastructure.Services;

public class TokenBlacklistService : ITokenBlacklistService
{
    private readonly IDistributedCache _cache;
    private readonly TimeSpan _ttl;
    private readonly ILogger<TokenBlacklistService> _logger;

    private static string Key(int userId) => $"blacklist:user:{userId}";

    public TokenBlacklistService(
        IDistributedCache cache,
        IConfiguration configuration,
        ILogger<TokenBlacklistService> logger)
    {
        _cache = cache;
        _logger = logger;
        var expiryMinutes = configuration
            .GetValue<int?>("JwtSettings:ExpiryMinutes") ?? 60;
        _ttl = TimeSpan.FromMinutes(expiryMinutes);
    }

    public async Task BlacklistUserAsync(int userId)
    {
        try
        {
            var nowUtc = DateTime.UtcNow.ToString("O");
            await _cache.SetStringAsync(
                Key(userId),
                nowUtc,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = _ttl
                });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Redis unavailable when blacklisting userId={UserId}. " +
                "Token will not be invalidated until Redis recovers.", userId);
        }
    }

    public async Task<DateTime?> GetBlacklistedSinceAsync(int userId)
    {
        try
        {
            var value = await _cache.GetStringAsync(Key(userId));
            if (string.IsNullOrEmpty(value)) return null;
            return DateTime.Parse(value, null,
                System.Globalization.DateTimeStyles.RoundtripKind);
        }
        catch (Exception ex)
        {
            // Redis down → fail-open: cho qua, không crash API
            // DB check (User.Status) trong middleware vẫn chặn được Suspended user
            _logger.LogWarning(ex,
                "Redis unavailable when checking blacklist for userId={UserId}. " +
                "Fail-open.", userId);
            return null;
        }
    }
}