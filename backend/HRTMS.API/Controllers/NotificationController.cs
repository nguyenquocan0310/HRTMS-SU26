using HRTMS.Core.Common;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

/// <summary>
/// NOTI — Notification endpoints.
/// GET  /api/notifications          → danh sách chưa đọc
/// GET  /api/notifications/all      → toàn bộ (có phân trang, page/pageSize)
/// GET  /api/notifications/count    → badge count
/// PATCH /api/notifications/{id}/read   → đánh dấu 1 đã đọc
/// PATCH /api/notifications/read-all   → đánh dấu tất cả đã đọc
/// </summary>
[Tags("notification")]
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>NOTI — Lấy danh sách notification chưa đọc.</summary>
    [HttpGet]
    public async Task<IActionResult> GetUnread()
    {
        var notifications = await _notificationService.GetUnreadAsync(CurrentUserId);
        return Ok(ApiResponse<object>.Ok(notifications));
    }

    /// <summary>NOTI — Lấy tất cả notification (cả đã đọc), hỗ trợ phân trang.</summary>
    [HttpGet("all")]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var notifications = await _notificationService.GetAllAsync(CurrentUserId, page, pageSize);
        return Ok(ApiResponse<object>.Ok(notifications));
    }

    /// <summary>NOTI — Số notification chưa đọc (dùng cho bell icon badge).</summary>
    [HttpGet("count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var count = await _notificationService.GetUnreadCountAsync(CurrentUserId);
        return Ok(ApiResponse<object>.Ok(new { count }));
    }

    /// <summary>NOTI — Đánh dấu một notification đã đọc.</summary>
    [HttpPatch("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        await _notificationService.MarkReadAsync(id, CurrentUserId);
        return NoContent();
    }

    /// <summary>NOTI — Đánh dấu tất cả notification đã đọc.</summary>
    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await _notificationService.MarkAllReadAsync(CurrentUserId);
        return NoContent();
    }
}