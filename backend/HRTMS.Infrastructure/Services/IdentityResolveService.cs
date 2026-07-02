using System.Security.Cryptography;
using System.Text;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class IdentityResolveService : IIdentityResolveService
{
    private readonly HRTMSDbContext _context;

    public IdentityResolveService(HRTMSDbContext context)
    {
        _context = context;
    }

    public async Task<IdentityResolveResult> ResolveAsync(string relatedIdentityNumber)
    {
        // Hash giong het cach AuthService.EncryptIdentity hash CCCD luc dang ky
        // (SHA256 tren UTF8 bytes cua CCCD da trim) - de dam bao so khop dung voi User.IdentityHash.
        var plain = Encoding.UTF8.GetBytes(relatedIdentityNumber.Trim());
        var hash = SHA256.HashData(plain);

        var matchedUser = await _context.Users
            .FirstOrDefaultAsync(u => u.IdentityHash != null && u.IdentityHash == hash);

        return matchedUser != null
            ? new IdentityResolveResult(matchedUser.UserId, "Exact", hash)
            : new IdentityResolveResult(null, "Unresolved", hash);
    }
}