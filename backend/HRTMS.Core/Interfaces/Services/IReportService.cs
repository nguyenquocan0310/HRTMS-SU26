using HRTMS.Core.DTOs.Report;

namespace HRTMS.Core.Interfaces.Services;

/// <summary>
/// Module P — Báo cáo & Xuất dữ liệu (REQ-F-RPT.1, RPT.3).
/// Service chịu trách nhiệm: validate type/format, RBAC filter (tại DB), query, build CSV, ghi AuditLog.
/// Controller chỉ lấy claims và map exception → status code.
/// </summary>
public interface IReportService
{
    /// <summary>
    /// Dữ liệu báo cáo đã lọc theo quyền của <paramref name="role"/>.
    /// Phục vụ preview và print-view của FE (RPT.2 — không render PDF phía server).
    /// </summary>
    /// <exception cref="ArgumentException"><paramref name="type"/> hoặc <paramref name="tournamentId"/> không hợp lệ.</exception>
    /// <exception cref="UnauthorizedAccessException">Role không hợp lệ hoặc không có quyền xem loại báo cáo này.</exception>
    /// <exception cref="KeyNotFoundException">Tournament không tồn tại.</exception>
    Task<ReportDataDto> GetReportAsync(string type, int tournamentId, int userId, string? role);

    /// <summary>
    /// Xuất CSV (UTF-8 BOM) và ghi AuditLog action <c>Export_Report</c> cho cả trường hợp thành công lẫn bị từ chối.
    /// Chỉ hỗ trợ <paramref name="format"/> = <c>csv</c> ở phase này.
    /// </summary>
    /// <exception cref="ArgumentException">type/format/tournamentId không hợp lệ.</exception>
    /// <exception cref="UnauthorizedAccessException">Role không hợp lệ hoặc không có quyền xem loại báo cáo này.</exception>
    /// <exception cref="KeyNotFoundException">Tournament không tồn tại.</exception>
    Task<ReportFileDto> ExportCsvAsync(string type, string? format, int tournamentId, int userId,
                                       string? role, string? ipAddress = null, string? userAgent = null);
}
