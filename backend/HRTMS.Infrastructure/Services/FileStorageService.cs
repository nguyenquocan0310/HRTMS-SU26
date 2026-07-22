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
    private readonly string _feeProofRootPath;

    public FileStorageService(IHostEnvironment env, IConfiguration config)
    {
        var configuredPath = config["FileStorage:CertificatesPath"];
        _rootPath = !string.IsNullOrWhiteSpace(configuredPath)
            ? configuredPath
            : Path.Combine(env.ContentRootPath, "App_Data", "uploads", "certificates");

        Directory.CreateDirectory(_rootPath);

        // Kho RIÊNG cho chứng từ lệ phí (patch 012) — tách khỏi kho chứng chỉ để
        // một lỗi phân quyền ở endpoint proof không làm lộ hồ sơ cá nhân/CCCD.
        var configuredProofPath = config["FileStorage:FeeProofsPath"];
        _feeProofRootPath = !string.IsNullOrWhiteSpace(configuredProofPath)
            ? configuredProofPath
            : Path.Combine(env.ContentRootPath, "App_Data", "uploads", "fee-proofs");

        Directory.CreateDirectory(_feeProofRootPath);
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

    public async Task<SavedFileResult> SaveFeeProofAsync(IFormFile file, int pairingId)
    {
        ValidateUpload(file, "chứng từ lệ phí");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var pairingFolder = Path.Combine(_feeProofRootPath, pairingId.ToString());
        Directory.CreateDirectory(pairingFolder);

        // Tên file sinh mới hoàn toàn từ Guid — KHÔNG dùng lại file.FileName nên
        // không có đường cho path traversal hay ký tự lạ lọt vào filesystem.
        var storedFileName = $"proof_{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(pairingFolder, storedFileName);

        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativePath = Path.Combine(pairingId.ToString(), storedFileName);

        return new SavedFileResult(relativePath, file.FileName, file.ContentType, file.Length);
    }

    public string? ResolvePhysicalPath(string storedFilePath) =>
        ResolveWithinRoot(_rootPath, storedFilePath);

    public string? ResolveFeeProofPhysicalPath(string storedFilePath) =>
        ResolveWithinRoot(_feeProofRootPath, storedFilePath);

    // Chặn path traversal: path thật phải nằm trong root tương ứng.
    private static string? ResolveWithinRoot(string root, string storedFilePath)
    {
        if (string.IsNullOrWhiteSpace(storedFilePath))
            return null;

        var rootFull = Path.GetFullPath(root);
        var fullPath = Path.GetFullPath(Path.Combine(rootFull, storedFilePath));

        // So sánh có separator ở cuối để "/data/uploads-evil" không lọt qua khi
        // root là "/data/uploads".
        var rootPrefix = rootFull.EndsWith(Path.DirectorySeparatorChar)
            ? rootFull
            : rootFull + Path.DirectorySeparatorChar;
        if (!fullPath.StartsWith(rootPrefix, StringComparison.Ordinal))
            return null;

        return File.Exists(fullPath) ? fullPath : null;
    }

    private static void ValidateUpload(IFormFile file, string label)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException($"File {label} không hợp lệ hoặc rỗng.");

        if (file.Length > MaxFileSizeBytes)
            throw new ArgumentException($"File {label} vượt quá kích thước tối đa 10MB.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new ArgumentException(
                $"Định dạng file không được hỗ trợ. Chỉ chấp nhận: {string.Join(", ", AllowedExtensions)}.");
    }

    public void DeleteIfExists(string storedFilePath)
    {
        var path = ResolvePhysicalPath(storedFilePath);
        if (path != null)
            File.Delete(path);
    }
}