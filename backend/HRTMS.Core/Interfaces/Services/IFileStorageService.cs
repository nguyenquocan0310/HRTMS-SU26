using Microsoft.AspNetCore.Http;

namespace HRTMS.Core.Interfaces.Services;

public record SavedFileResult(string FilePath, string FileName, string ContentType, long FileSizeBytes);

/// <summary>
/// Lưu trữ file upload (chứng chỉ, minh chứng chuyên môn...) ra ngoài wwwroot
/// (private storage) — file chỉ được đọc lại qua endpoint có Authorize,
/// không public trực tiếp qua static file hosting.
/// </summary>
public interface IFileStorageService
{
    Task<SavedFileResult> SaveCertificateAsync(IFormFile file, int userId, string certificateType);

    /// <summary>Trả về full physical path để đọc/stream file, hoặc null nếu không tồn tại.</summary>
    string? ResolvePhysicalPath(string storedFilePath);

    void DeleteIfExists(string storedFilePath);

    /// <summary>
    /// Lưu chứng từ lệ phí (patch 013) vào kho private RIÊNG, tách khỏi kho chứng
    /// chỉ để một lỗi phân quyền ở endpoint này không làm lộ hồ sơ cá nhân/CCCD.
    /// Dùng chung bộ validate (extension, kích thước) với chứng chỉ.
    /// </summary>
    Task<SavedFileResult> SaveFeeProofAsync(IFormFile file, int pairingId);

    /// <summary>Full physical path của chứng từ lệ phí, hoặc null nếu không tồn tại.</summary>
    string? ResolveFeeProofPhysicalPath(string storedFilePath);
}