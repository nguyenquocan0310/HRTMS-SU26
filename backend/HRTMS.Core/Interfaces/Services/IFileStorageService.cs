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
}