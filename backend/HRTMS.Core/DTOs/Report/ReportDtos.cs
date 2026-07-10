namespace HRTMS.Core.DTOs.Report;

/// <summary>
/// Bốn loại báo cáo của Module P (REQ-F-RPT.1). Client gửi slug ở route,
/// service map sang enum này — không nhận tên bảng/property từ client.
/// </summary>
public enum ReportType
{
    TournamentResults,
    RaceResults,
    PursePayouts,
    EntryList
}

/// <summary>
/// Dữ liệu báo cáo dạng bảng: header cố định + rows theo thứ tự cột ổn định.
/// Dùng chung cho export CSV (RPT.1) và JSON preview/print-view (RPT.2, FE render).
/// </summary>
public sealed class ReportDataDto
{
    public string Type { get; set; } = string.Empty;

    public int TournamentId { get; set; }

    public string TournamentName { get; set; } = string.Empty;

    public string[] Headers { get; set; } = Array.Empty<string>();

    public List<string?[]> Rows { get; set; } = new();
}

/// <summary>File CSV đã dựng sẵn (kèm BOM) để controller trả FileContentResult.</summary>
public sealed class ReportFileDto
{
    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = "text/csv";

    public byte[] Content { get; set; } = Array.Empty<byte>();
}
