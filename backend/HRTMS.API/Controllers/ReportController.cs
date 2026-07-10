using System.Security.Claims;
using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Report;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTMS.API.Controllers;

/// <summary>
/// Module P — Reports &amp; Export (UI-S18).
/// Mọi nghiệp vụ query/RBAC/audit nằm trong <see cref="IReportService"/>;
/// controller chỉ đọc claims và map exception → status code.
/// PDF server-side không thuộc phase này — FE dựng print-view từ endpoint JSON.
/// </summary>
[Tags("reports")]
[ApiController]
[Authorize]
[Route("api/reports")]
public class ReportController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportController(IReportService reportService)
    {
        _reportService = reportService;
    }

    // userId/role LUÔN lấy từ claims — không nhận từ query string hay body.
    private bool TryGetIdentity(out int userId, out string? role)
    {
        role = User.FindFirstValue(ClaimTypes.Role);
        return int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
    }

    // =====================================================================
    // GET /api/reports/{type}/export?format=csv&tournamentId={id}
    // REQ-F-RPT.1 — CSV (UTF-8 BOM), ghi AuditLog Export_Report
    // =====================================================================
    [HttpGet("{type}/export")]
    public async Task<IActionResult> Export(string type, [FromQuery] int tournamentId, [FromQuery] string? format)
    {
        if (!TryGetIdentity(out var userId, out var role))
            return Unauthorized(ApiResponse<object>.Fail("Phiên đăng nhập không hợp lệ."));

        try
        {
            var file = await _reportService.ExportCsvAsync(
                type, format, tournamentId, userId, role,
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                Request.Headers.UserAgent.ToString());

            return File(file.Content, file.ContentType, file.FileName);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail(ex.Message));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }

    // =====================================================================
    // GET /api/reports/{type}?tournamentId={id}
    // REQ-F-RPT.2 — dữ liệu cho preview + print-view (FE gọi window.print())
    // =====================================================================
    [HttpGet("{type}")]
    public async Task<ActionResult<ApiResponse<ReportDataDto>>> GetReport(string type, [FromQuery] int tournamentId)
    {
        if (!TryGetIdentity(out var userId, out var role))
            return Unauthorized(ApiResponse<ReportDataDto>.Fail("Phiên đăng nhập không hợp lệ."));

        try
        {
            var data = await _reportService.GetReportAsync(type, tournamentId, userId, role);
            return Ok(ApiResponse<ReportDataDto>.Ok(data));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<ReportDataDto>.Fail(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<ReportDataDto>.Fail(ex.Message));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<ReportDataDto>.Fail(ex.Message));
        }
    }
}
