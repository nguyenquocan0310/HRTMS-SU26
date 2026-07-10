using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

/// <summary>
/// ACC.1A — Xem/tải file chứng chỉ đã upload khi đăng ký (Jockey/Referee/Doctor).
/// File KHÔNG được serve qua static hosting công khai — chỉ Admin (để duyệt hồ sơ)
/// hoặc chính chủ tài khoản (để xem lại trong Profile) mới được truy cập.
/// </summary>
[Tags("certificates")]
[ApiController]
[Route("api/certificates")]
[Authorize]
public class CertificatesController : ControllerBase
{
    private readonly HRTMSDbContext _context;
    private readonly IFileStorageService _fileStorageService;
    private static readonly FileExtensionContentTypeProvider ContentTypeProvider = new();

    public CertificatesController(HRTMSDbContext context, IFileStorageService fileStorageService)
    {
        _context = context;
        _fileStorageService = fileStorageService;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsAdmin => User.IsInRole("Admin");

    /// <summary>Xem thông tin (metadata) chứng chỉ của chính mình.</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMyCertificate()
    {
        var cert = await _context.Certificates
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == CurrentUserId);

        if (cert == null)
            return NotFound(new { success = false, message = "Bạn chưa upload file chứng chỉ nào." });

        return Ok(new
        {
            success = true,
            data = new
            {
                cert.CertificateId,
                cert.CertificateType,
                cert.FileName,
                cert.ContentType,
                cert.FileSizeBytes,
                cert.UploadedAt,
                DownloadUrl = Url.Action(nameof(Download), "Certificates", new { id = cert.CertificateId })
            }
        });
    }

    /// <summary>Admin xem thông tin chứng chỉ của một user cụ thể (phục vụ duyệt hồ sơ).</summary>
    [HttpGet("user/{userId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetByUserId(int userId)
    {
        var cert = await _context.Certificates
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.UserId == userId);

        if (cert == null)
            return NotFound(new { success = false, message = "User này chưa upload file chứng chỉ nào." });

        return Ok(new
        {
            success = true,
            data = new
            {
                cert.CertificateId,
                cert.CertificateType,
                cert.FileName,
                cert.ContentType,
                cert.FileSizeBytes,
                cert.UploadedAt,
                DownloadUrl = Url.Action(nameof(Download), "Certificates", new { id = cert.CertificateId })
            }
        });
    }

    /// <summary>Tải/xem trực tiếp file chứng chỉ — chỉ Admin hoặc chính chủ.</summary>
    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var cert = await _context.Certificates
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CertificateId == id);

        if (cert == null)
            return NotFound(new { success = false, message = "Không tìm thấy chứng chỉ." });

        if (!IsAdmin && cert.UserId != CurrentUserId)
            return Forbid();

        var physicalPath = _fileStorageService.ResolvePhysicalPath(cert.FilePath);
        if (physicalPath == null)
            return NotFound(new { success = false, message = "File chứng chỉ không còn tồn tại trên server." });

        if (!ContentTypeProvider.TryGetContentType(physicalPath, out var contentType))
            contentType = cert.ContentType ?? "application/octet-stream";

        var stream = System.IO.File.OpenRead(physicalPath);
        return File(stream, contentType, cert.FileName);
    }
}