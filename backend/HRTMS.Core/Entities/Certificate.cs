using System;

namespace HRTMS.Core.Entities;

/// <summary>
/// Lưu file chứng chỉ/bằng cấp do người dùng upload khi đăng ký các role
/// cần thẩm định chuyên môn (Jockey/Referee/Doctor).
/// Thay thế cho việc chỉ nhập tên/số chứng chỉ dạng text như trước đây.
/// Mỗi User chỉ giữ 1 bản ghi Certificate hiện hành (upload lại sẽ ghi đè).
/// </summary>
public partial class Certificate
{
    public int CertificateId { get; set; }

    public int UserId { get; set; }

    /// <summary>Role tại thời điểm upload: Jockey/Referee/Doctor.</summary>
    public string CertificateType { get; set; } = null!;

    /// <summary>Tên file gốc do người dùng upload (hiển thị lại cho Admin/Profile).</summary>
    public string FileName { get; set; } = null!;

    /// <summary>Đường dẫn lưu trữ vật lý trên server (không public trực tiếp).</summary>
    public string FilePath { get; set; } = null!;

    public string ContentType { get; set; } = null!;

    public long FileSizeBytes { get; set; }

    public DateTime UploadedAt { get; set; }

    public virtual User User { get; set; } = null!;
}