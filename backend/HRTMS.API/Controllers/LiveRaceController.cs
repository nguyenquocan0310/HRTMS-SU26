using HRTMS.Core.Common;
using HRTMS.Core.DTOs.LiveRace;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

// Module H mở rộng — UI-S07 Live Race Simulation.
// Animation vị trí % là random walk thuần client-side (không WebSocket/SSE),
// controller này chỉ cấp dữ liệu thật: trạng thái/actualStartTime, kết quả cuối
// (FinishPosition) và violation ghi nhận trong lúc Live.
[Tags("race")]
[ApiController]
[Authorize]
public class LiveRaceController : ControllerBase
{
    private readonly ILiveRaceService _service;

    public LiveRaceController(ILiveRaceService service)
    {
        _service = service;
    }

    private bool TryGetUserId(out int userId)
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out userId);
    }

    // Public (mọi role đã đăng nhập): Owner/Jockey/Spectator xem để render chip
    // ngựa + biết animation phải "về đích" theo thứ tự nào khi Unofficial.
    [HttpGet("api/races/{raceId:int}/live-status")]
    [ProducesResponseType(typeof(ApiResponse<LiveRaceStatusDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLiveStatus(int raceId)
    {
        try
        {
            var result = await _service.GetLiveStatusAsync(raceId);
            return Ok(ApiResponse<LiveRaceStatusDto>.Ok(result));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<LiveRaceStatusDto>.Fail("Không tìm thấy cuộc đua."));
        }
    }

    // Public: danh sách violation để Owner/Spectator poll riêng (3-5s), overlay
    // lên trên animation — không ảnh hưởng thuật toán tính vị trí ngựa.
    [HttpGet("api/races/{raceId:int}/violations")]
    [ProducesResponseType(typeof(ApiResponse<List<ViolationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetViolations(int raceId)
    {
        try
        {
            var result = await _service.GetViolationsAsync(raceId);
            return Ok(ApiResponse<List<ViolationDto>>.Ok(result));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<List<ViolationDto>>.Fail("Không tìm thấy cuộc đua."));
        }
    }

    // Referee (được assign vào race) bấm "Start Race" trên RefereeRaceConsole.
    [HttpPost("api/referees/races/{raceId:int}/start")]
    [Authorize(Roles = "Referee")]
    [ProducesResponseType(typeof(ApiResponse<StartRaceResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> StartRace(int raceId)
    {
        if (!TryGetUserId(out var refereeId))
            return Unauthorized(ApiResponse<StartRaceResultDto>.Fail("Phiên đăng nhập không hợp lệ."));

        try
        {
            var result = await _service.StartRaceAsync(raceId, refereeId);
            return Ok(ApiResponse<StartRaceResultDto>.Ok(result, "Race đã chuyển sang Live."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(ApiResponse<StartRaceResultDto>.Fail("Không tìm thấy cuộc đua."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "REFEREE_NOT_FOUND")
        {
            return NotFound(ApiResponse<StartRaceResultDto>.Fail("Không tìm thấy hồ sơ trọng tài."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<StartRaceResultDto>.Fail("Bạn không được phân công cho cuộc đua này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "INVALID_RACE_STATE")
        {
            return Conflict(ApiResponse<StartRaceResultDto>.Fail("Cuộc đua hiện không ở trạng thái có thể bắt đầu."));
        }
    }

    // Referee ghi nhận vi phạm trong lúc race đang Live.
    [HttpPost("api/referees/races/{raceId:int}/violations")]
    [Authorize(Roles = "Referee")]
    [ProducesResponseType(typeof(ApiResponse<ViolationDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> RecordViolation(int raceId, [FromBody] CreateViolationDto dto)
    {
        if (!TryGetUserId(out var refereeId))
            return Unauthorized(ApiResponse<ViolationDto>.Fail("Phiên đăng nhập không hợp lệ."));

        try
        {
            var result = await _service.RecordViolationAsync(raceId, refereeId, dto);
            return Created($"/api/races/{raceId}/violations", ApiResponse<ViolationDto>.Ok(result, "Đã ghi nhận vi phạm."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<ViolationDto>.Fail(MapValidationMessage(ex.Message)));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(ApiResponse<ViolationDto>.Fail("Không tìm thấy cuộc đua."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "REFEREE_NOT_FOUND")
        {
            return NotFound(ApiResponse<ViolationDto>.Fail("Không tìm thấy hồ sơ trọng tài."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        {
            return NotFound(ApiResponse<ViolationDto>.Fail("Không tìm thấy vận động viên (race entry) trong cuộc đua này."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "PLACE_BEHIND_ENTRY_NOT_FOUND")
        {
            return NotFound(ApiResponse<ViolationDto>.Fail("Không tìm thấy race entry bị xếp phía sau (PlaceBehind)."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<ViolationDto>.Fail("Bạn không được phân công cho cuộc đua này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_LIVE")
        {
            return Conflict(ApiResponse<ViolationDto>.Fail("Chỉ có thể ghi nhận vi phạm khi cuộc đua đang Live."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_REPORT_LOCKED")
        {
            return Conflict(ApiResponse<ViolationDto>.Fail("Biên bản thi đấu của cuộc đua này đã bị khóa."));
        }
    }

    // Referee chốt sơ bộ FinishPosition (kết thúc màn Live), chuyển Live -> Unofficial.
    [HttpPost("api/referees/races/{raceId:int}/finish")]
    [Authorize(Roles = "Referee")]
    [ProducesResponseType(typeof(ApiResponse<SubmitFinishResultsResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SubmitFinishResults(int raceId, [FromBody] SubmitFinishResultsDto dto)
    {
        if (!TryGetUserId(out var refereeId))
            return Unauthorized(ApiResponse<SubmitFinishResultsResultDto>.Fail("Phiên đăng nhập không hợp lệ."));

        try
        {
            var result = await _service.SubmitFinishResultsAsync(raceId, refereeId, dto);
            return Ok(ApiResponse<SubmitFinishResultsResultDto>.Ok(result, "Đã chốt kết quả sơ bộ, cuộc đua chuyển sang Unofficial."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<SubmitFinishResultsResultDto>.Fail(MapValidationMessage(ex.Message)));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(ApiResponse<SubmitFinishResultsResultDto>.Fail("Không tìm thấy cuộc đua."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "REFEREE_NOT_FOUND")
        {
            return NotFound(ApiResponse<SubmitFinishResultsResultDto>.Fail("Không tìm thấy hồ sơ trọng tài."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_ENTRY_NOT_FOUND")
        {
            return NotFound(ApiResponse<SubmitFinishResultsResultDto>.Fail("Có race entry trong kết quả không thuộc cuộc đua này (hoặc đã rút lui/hủy)."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse<SubmitFinishResultsResultDto>.Fail("Bạn không được phân công cho cuộc đua này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_LIVE")
        {
            return Conflict(ApiResponse<SubmitFinishResultsResultDto>.Fail("Chỉ có thể chốt kết quả khi cuộc đua đang Live."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_REPORT_LOCKED")
        {
            return Conflict(ApiResponse<SubmitFinishResultsResultDto>.Fail("Biên bản thi đấu của cuộc đua này đã bị khóa."));
        }
    }

    private static string MapValidationMessage(string code) => code switch
    {
        "VIOLATION_CODE_REQUIRED" => "Vui lòng nhập mã vi phạm.",
        "DESCRIPTION_REQUIRED" => "Vui lòng nhập mô tả vi phạm.",
        "INVALID_PENALTY" => "Hình thức xử phạt không hợp lệ (Disqualified/PlaceBehind/Warning/Scratch).",
        "PLACE_BEHIND_ENTRY_REQUIRED" => "Vui lòng chọn race entry bị xếp phía sau khi hình phạt là PlaceBehind.",
        "RESULTS_REQUIRED" => "Vui lòng nhập kết quả về đích.",
        "DUPLICATE_RACE_ENTRY_IN_RESULTS" => "Một race entry không được xuất hiện nhiều lần trong kết quả.",
        "DUPLICATE_FINISH_POSITION" => "Không được có 2 race entry cùng một thứ hạng về đích.",
        "INVALID_FINISH_POSITION" => "Thứ hạng về đích phải lớn hơn 0.",
        _ => "Dữ liệu không hợp lệ."
    };
}
