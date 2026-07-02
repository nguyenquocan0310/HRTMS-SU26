namespace HRTMS.Core.Interfaces.Services;

/// <summary>
/// Ket qua resolve danh tinh nguoi than dua tren CCCD.
/// RelatedUserId != null khi va chi khi tim thay User co IdentityHash trung khop.
/// MatchConfidence chi con 2 gia tri thuc te: "Exact" (khop CCCD) hoac "Unresolved" (khong khop).
/// </summary>
public record IdentityResolveResult(int? RelatedUserId, string MatchConfidence, byte[] RelatedIdentityHash);

/// <summary>
/// Resolve danh tinh nguoi than duoc khai bao trong FamilyRelationshipDeclaration
/// bang co che DUY NHAT: so khop hash CCCD (SHA256) voi User.IdentityHash da co san
/// tu luc dang ky (bat buoc voi Owner/Jockey/Referee/Doctor - xem RegisterDto ACC.1A).
/// Khong dung ten/email/phone de match - tranh false positive tu du lieu it tin cay.
/// </summary>
public interface IIdentityResolveService
{
    /// <summary>
    /// Nhan CCCD (12 so, plaintext) cua nguoi than duoc khai bao, tra ve ket qua resolve.
    /// </summary>
    Task<IdentityResolveResult> ResolveAsync(string relatedIdentityNumber);
}