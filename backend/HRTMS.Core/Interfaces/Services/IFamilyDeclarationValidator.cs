
using HRTMS.Core.DTOs.FamilyDeclaration;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services;

/// <summary>
/// Validator dùng chung cho khai báo quan hệ gia đình (FRD), tách riêng khỏi
/// AuthService và FamilyDeclarationService để tránh circular dependency (vòng
/// phụ thuộc DI khi 2 service cần gọi lẫn nhau).
/// Dùng ở 2 nơi:
///   1. AuthService.RegisterAsync — khi Jockey/Referee khai FRD lúc đăng ký (EC-18)
///   2. FamilyDeclarationService — khi CRUD FRD sau khi đã có tài khoản (UI-S25/S27/S30)
/// </summary>
public interface IFamilyDeclarationValidator
{
    /// <summary>
    /// Validate danh sách khai báo FRD. Trả về null nếu hợp lệ, trả về chuỗi lỗi nếu không.
    /// </summary>
    /// <param name="declarations">Danh sách khai báo cần validate</param>
    /// <param name="declarantUserId">0 khi gọi từ Register (UserId chưa tồn tại)</param>
    /// <param name="isRegister">true = bỏ qua bước check trùng với DB (vì user chưa có trong DB)</param>
    Task<string?> ValidateAsync(
        List<FamilyDeclarationItemDto> declarations,
        int declarantUserId,
        bool isRegister = false);

    /// <summary>
    /// Validate riêng cho 1 khai báo khi Update — loại trừ chính dòng đang sửa
    /// khỏi bước check trùng, tránh false positive (sửa dòng không đổi RelatedUserId
    /// vẫn báo trùng với chính nó).
    /// </summary>
    Task<string?> ValidateForUpdateAsync(
        FamilyDeclarationItemDto dto,
        int declarantUserId,
        int excludeDeclarationId);
}