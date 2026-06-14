namespace HRTMS.Core.Interfaces.Services;

public interface ITokenBlacklistService
{
	/// <summary>
	/// Invalidate all tokens issued before now for the given user.
	/// Any request with a JWT whose "iat" is older than the stored
	/// timestamp must be rejected with 401, even if the signature is valid.
	/// </summary>
	Task BlacklistUserAsync(int userId);

	/// <summary>
	/// Returns the UTC timestamp after which tokens for this user are
	/// considered invalid, or null if the user has never been blacklisted.
	/// </summary>
	Task<DateTime?> GetBlacklistedSinceAsync(int userId);
}