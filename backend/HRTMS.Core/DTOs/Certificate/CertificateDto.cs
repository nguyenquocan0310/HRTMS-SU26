namespace HRTMS.Core.DTOs.Certificate;

/// <summary>
/// Thông tin chứng chỉ trả về cho Admin (duyệt hồ sơ) và cho chính chủ (xem Profile).
/// KHÔNG trả FilePath vật lý — chỉ trả DownloadUrl để tải qua endpoint có Authorize.
/// </summary>
public class CertificateDto
{
    public int CertificateId { get; set; }
    public string CertificateType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public DateTime UploadedAt { get; set; }
    public string DownloadUrl { get; set; } = string.Empty;
}