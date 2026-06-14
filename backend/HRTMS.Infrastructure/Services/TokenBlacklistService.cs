using HRTMS.Core.Interfaces.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;

namespace HRTMS.Infrastructure.Services;

public class TokenBlacklistService : ITokenBlacklistService
{
    private readonly IDistributedCache _cache;
    private readonly TimeSpan _ttl;

    private static string Key(int userId) => $"blacklist:user:{userId}";

    public TokenBlacklistService(IDistributedCache cache, IConfiguration configuration)
    {
        _cache = cache;

        // TTL should be >= JWT expiry so the key auto-expires once every
        // old token would have expired anyway.
        var expiryMinutes = configuration.GetValue<int?>("JwtSettings:ExpiryMinutes") ?? 60;
        _ttl = TimeSpan.FromMinutes(expiryMinutes);
    }

    public async Task BlacklistUserAsync(int userId)
    {
        var nowUtc = DateTime.UtcNow.ToString("O"); // ISO 8601 round-trip
        await _cache.SetStringAsync(
            Key(userId),
            nowUtc,
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _ttl });
    }

    public async Task<DateTime?> GetBlacklistedSinceAsync(int userId)
    {
        var value = await _cache.GetStringAsync(Key(userId));
        if (string.IsNullOrEmpty(value)) return null;
        return DateTime.Parse(value, null, System.Globalization.DateTimeStyles.RoundtripKind);
    }
}