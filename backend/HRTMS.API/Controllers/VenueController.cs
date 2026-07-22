using HRTMS.Core.DTOs.Venue;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

// Module B — Sân đua (patch 012).
// GET /api/venues là public (FE cần hiển thị sân của giải cho khán giả);
// mọi thao tác ghi nằm dưới /api/admin/venues và yêu cầu role Admin.
[Tags("venues")]
[ApiController]
[Route("api")]
public class VenueController : ControllerBase
{
    private readonly IVenueService _service;

    public VenueController(IVenueService service)
    {
        _service = service;
    }

    // Danh sách sân. Mặc định CHỈ trả sân đang hoạt động.
    // includeInactive=true chỉ có hiệu lực với Admin — người dùng thường truyền
    // cờ này vẫn chỉ nhận được sân active.
    [HttpGet("venues")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
    {
        var isAdmin = User.Identity?.IsAuthenticated == true && User.IsInRole("Admin");
        var result = await _service.GetAllAsync(includeInactive && isAdmin);
        return Ok(result);
    }

    // Danh sách vận hành tách route public: Admin luôn nhìn được inactive và có
    // filter server-side. Không dùng includeInactive trên route public làm contract
    // quản trị, để tránh FE vô tình gọi nhầm rồi mất dữ liệu inactive.
    [HttpGet("admin/venues")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminList(
        [FromQuery] string? search,
        [FromQuery] string? city,
        [FromQuery] string? trackType,
        [FromQuery] bool? isActive)
    {
        try
        {
            var result = await _service.GetAdminListAsync(search, city, trackType, isActive);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(Err("INVALID_VENUE_DATA", ex.Message));
        }
    }

    [HttpGet("venues/{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var venue = await _service.GetByIdAsync(id);
        if (venue == null)
            return NotFound(Err("VENUE_NOT_FOUND", "Không tìm thấy sân đua."));

        // Sân inactive chỉ Admin được xem chi tiết.
        var isAdmin = User.Identity?.IsAuthenticated == true && User.IsInRole("Admin");
        if (!venue.IsActive && !isAdmin)
            return NotFound(Err("VENUE_NOT_FOUND", "Không tìm thấy sân đua."));

        return Ok(venue);
    }

    [HttpPost("admin/venues")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateVenueDto dto)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.CreateAsync(dto, adminId);
            return Created($"/api/venues/{result.VenueId}", result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(Err("INVALID_VENUE_DATA", ex.Message));
        }
        catch (InvalidOperationException ex) when (ex.Message == "VENUE_NAME_DUPLICATE")
        {
            return Conflict(Err("VENUE_NAME_DUPLICATE", "Đã có sân đua khác dùng tên này."));
        }
    }

    [HttpPut("admin/venues/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateVenueDto dto)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.UpdateAsync(id, dto, adminId);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(Err("VENUE_NOT_FOUND", "Không tìm thấy sân đua."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(Err("INVALID_VENUE_DATA", ex.Message));
        }
        catch (InvalidOperationException ex) when (ex.Message == "VENUE_NAME_DUPLICATE")
        {
            return Conflict(Err("VENUE_NAME_DUPLICATE", "Đã có sân đua khác dùng tên này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "LANE_COUNT_BELOW_TOURNAMENT_MAX_HORSES")
        {
            return UnprocessableEntity(Err("LANE_COUNT_BELOW_TOURNAMENT_MAX_HORSES",
                "Không thể giảm số làn xuống dưới số ngựa tối đa của một giải đang dùng sân này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "VENUE_TRACK_TYPE_IN_USE")
        {
            return UnprocessableEntity(Err("VENUE_TRACK_TYPE_IN_USE",
                "Không thể đổi loại mặt sân khi còn giải đấu đang dùng trường đua này."));
        }
    }

    // ---------------- helpers ----------------

    private bool TryGetUserId(out int userId)
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out userId);
    }

    private IActionResult UnauthorizedResult() =>
        Unauthorized(Err("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ."));

    private static object Err(string error, string message) => new { error, message };
}
