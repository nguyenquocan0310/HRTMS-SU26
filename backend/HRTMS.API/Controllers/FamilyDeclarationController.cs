// FILE: backend/HRTMS.API/Controllers/FamilyDeclarationController.cs
using HRTMS.Core.Common;
using HRTMS.Core.DTOs.FamilyDeclaration;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("referee")]
[ApiController]
[Route("api/family-declarations")]
[Authorize(Roles = "Owner,Jockey,Referee,Doctor")] // 4 role bắt buộc khai báo FRD, trừ Admin và Spectator
public class FamilyDeclarationController : ControllerBase
{
    private readonly IFamilyDeclarationService _service;

    public FamilyDeclarationController(IFamilyDeclarationService service)
    {
        _service = service;
    }

    private int GetCurrentUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/family-declarations
    // UI-S25 (Jockey), UI-S27 (Referee), UI-S30 (Doctor)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<FamilyDeclarationResponseDto>>>> GetMyDeclarations()
    {
        var result = await _service.GetMyDeclarationsAsync(GetCurrentUserId());
        return Ok(ApiResponse<List<FamilyDeclarationResponseDto>>.Ok(result));
    }

    // POST /api/family-declarations
    [HttpPost]
    public async Task<ActionResult<ApiResponse<FamilyDeclarationResponseDto>>> Add(
        [FromBody] FamilyDeclarationItemDto dto)
    {
        try
        {
            var result = await _service.AddDeclarationAsync(GetCurrentUserId(), dto);
            return Ok(ApiResponse<FamilyDeclarationResponseDto>.Ok(result, "Thêm khai báo thành công"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<FamilyDeclarationResponseDto>.Fail(ex.Message));
        }
    }

    // PUT /api/family-declarations/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<FamilyDeclarationResponseDto>>> Update(
        int id, [FromBody] FamilyDeclarationItemDto dto)
    {
        try
        {
            var result = await _service.UpdateDeclarationAsync(GetCurrentUserId(), id, dto);
            return Ok(ApiResponse<FamilyDeclarationResponseDto>.Ok(result, "Cập nhật khai báo thành công"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<FamilyDeclarationResponseDto>.Fail(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<FamilyDeclarationResponseDto>.Fail(ex.Message));
        }
    }

    // DELETE /api/family-declarations/{id}
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(int id)
    {
        try
        {
            await _service.DeleteDeclarationAsync(GetCurrentUserId(), id);
            return Ok(ApiResponse<object>.Ok(null!, "Xóa khai báo thành công"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<object>.Fail(ex.Message));
        }
    }
}

// ============================================================
// Autocomplete endpoint — đặt trong UserController hoặc tách riêng tùy cấu trúc project.
// Nếu project đã có UserController thì chuyển action này vào đó.
// ============================================================
[ApiController]
[Route("api/users")]
[Authorize] // mọi Role đã đăng nhập đều dùng được (cần để điền ô autocomplete khi Register)
public class UserSearchController : ControllerBase
{
    private readonly IFamilyDeclarationService _service;

    public UserSearchController(IFamilyDeclarationService service)
    {
        _service = service;
    }

    private int GetCurrentUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // GET /api/users/search-industry?q=nguyen
    // Autocomplete tìm user trong ngành để gợi ý ô nhập tên người thân
    // Tối thiểu 2 ký tự, trả về tối đa 10 kết quả
    [HttpGet("search-industry")]
    public async Task<ActionResult<ApiResponse<List<IndustryUserSearchResultDto>>>> SearchIndustry(
        [FromQuery] string q)
    {
        var result = await _service.SearchIndustryUsersAsync(q, GetCurrentUserId());
        return Ok(ApiResponse<List<IndustryUserSearchResultDto>>.Ok(result));
    }
}