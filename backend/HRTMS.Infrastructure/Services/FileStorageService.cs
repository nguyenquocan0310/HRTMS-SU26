using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace HRTMS.Infrastructure.Services;

/// <summary>
/// Lưu file chứng chỉ vào thư mục private (ngoài wwwroot, KHÔNG serve qua static
/// file hosting) để tránh lộ hồ sơ cá nhân/CCCD/bằng cấp cho người không có quyền.
/// File chỉ đọc lại được qua CertificatesController (yêu cầu Authorize + kiểm tra quyền).
/// </summary>
public class FileStorageService : IFileStorageService
{
    private static readonly string[] AllowedExtensions = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10MB

    private readonly string _rootPath;

    public FileStorageService(IHostEnvironment env, IConfiguration config)
    {
        var configuredPath = config["FileStorage:CertificatesPath"];
        _rootPath = !string.IsNullOrWhiteSpace(configuredPath)
            ? configuredPath
            : Path.Combine(env.ContentRootPath, "App_Data", "uploads", "certificates");

        Directory.CreateDirectory(_rootPath);
    }

    public async Task<SavedFileResult> SaveCertificateAsync(IFormFile file, int userId, string certificateType)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("File chứng chỉ không hợp lệ hoặc rỗng.");

        if (file.Length > MaxFileSizeBytes)
            throw new ArgumentException("File chứng chỉ vượt quá kích thước tối đa 10MB.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new ArgumentException(
                $"Định dạng file không được hỗ trợ. Chỉ chấp nhận: {string.Join(", ", AllowedExtensions)}.");

        var userFolder = Path.Combine(_rootPath, userId.ToString());
        Directory.CreateDirectory(userFolder);

        var storedFileName = $"{certificateType}_{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(userFolder, storedFileName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Lưu path tương đối (userId/filename) — độc lập với vị trí ổ đĩa thật,
        // dễ di chuyển giữa các môi trường.
        var relativePath = Path.Combine(userId.ToString(), storedFileName);

        return new SavedFileResult(relativePath, file.FileName, file.ContentType, file.Length);
    }

    public string? ResolvePhysicalPath(string storedFilePath)
    {
        var fullPath = Path.GetFullPath(Path.Combine(_rootPath, storedFilePath));

        // Chặn path traversal: đảm bảo path thật vẫn nằm trong _rootPath.
        if (!fullPath.StartsWith(Path.GetFullPath(_rootPath), StringComparison.Ordinal))
            return null;

        return File.Exists(fullPath) ? fullPath : null;
    }

    public void DeleteIfExists(string storedFilePath)
    {
        var path = ResolvePhysicalPath(storedFilePath);
        if (path != null)
            File.Delete(path);
    }
}