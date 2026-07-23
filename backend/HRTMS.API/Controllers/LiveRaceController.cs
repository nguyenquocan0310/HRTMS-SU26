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
        catch (InvalidOperationException ex) when (ex.Message == "NO_ELIGIBLE_STARTING_ENTRIES")
        {
            return Conflict(ApiResponse<StartRaceResultDto>.Fail("No eligible race entries remain for the starting list."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "STARTING_LIST_INVALID")
        {
            return Conflict(ApiResponse<StartRaceResultDto>.Fail("Starting list is no longer eligible to go live."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "STARTING_LIST_NOT_CONFIRMED")
        {
            return Conflict(ApiResponse<StartRaceResultDto>.Fail("Chưa xác nhận danh sách xuất phát chính thức (race phải ở trạng thái Pre-Race)."));
        }
    }

    // Referee ghi nhận vi phạm trong lúc race đang Live.
    [HttpGet("api/violations/codes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ViolationCodeOptionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetViolationCodes()
    {
        var result = await _service.GetViolationCodesAsync();
        return Ok(ApiResponse<IReadOnlyList<ViolationCodeOptionDto>>.Ok(result));
    }

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
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ENTRY_NOT_ELIGIBLE")
        {
            return Conflict(ApiResponse<ViolationDto>.Fail("Race entry is cancelled, withdrawn, or disqualified."));
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

    [HttpPatch("api/referees/races/{raceId:int}/entries/{raceEntryId:int}/dnf")]
    [Authorize(Roles = "Referee")]
    [ProducesResponseType(typeof(ApiResponse<MarkDnfResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkDnf(int raceId, int raceEntryId, [FromBody] MarkDnfDto dto)
    {
        if (!TryGetUserId(out var refereeId))
            return Unauthorized(ApiResponse<MarkDnfResultDto>.Fail("Phiên đăng nhập không hợp lệ."));

        try
        {
            var result = await _service.MarkDnfAsync(raceId, raceEntryId, refereeId, dto);
            return Ok(ApiResponse<MarkDnfResultDto>.Ok(result, "Đã ghi nhận ngựa bỏ cuộc (DNF)."));
        }
        catch (ArgumentException ex) when (ex.Message == "DNF_REASON_REQUIRED")
        {
            return BadRequest(ApiResponse<MarkDnfResultDto>.Fail("Lý do DNF phải có ít nhất 10 ký tự."));
        }
        catch (KeyNotFoundException ex) when (ex.Message is "RACE_NOT_FOUND" or "RACE_ENTRY_NOT_FOUND" or "REFEREE_NOT_FOUND")
        {
            return NotFound(ApiResponse<MarkDnfResultDto>.Fail("Không tìm thấy race, race entry hoặc trọng tài."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<MarkDnfResultDto>.Fail("Bạn không được phân công cho cuộc đua này."));
        }
        catch (InvalidOperationException ex) when (ex.Message is "RACE_NOT_LIVE" or "RACE_ENTRY_NOT_ELIGIBLE" or "RACE_ENTRY_ALREADY_DNF")
        {
            return Conflict(ApiResponse<MarkDnfResultDto>.Fail("Race entry không thể được ghi nhận DNF ở trạng thái hiện tại."));
        }
    }

    // Referee chốt sơ bộ FinishPosition (kết thúc màn Live), chuyển Live -> Unofficial.
    [HttpPatch("api/referees/races/{raceId:int}/violations/{violationId:int}")]
    [Authorize(Roles = "Referee")]
    [ProducesResponseType(typeof(ApiResponse<ViolationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateViolation(int raceId, int violationId, [FromBody] UpdateViolationDto dto)
    {
        if (!TryGetUserId(out var refereeId))
            return Unauthorized(ApiResponse<ViolationDto>.Fail("Invalid session."));

        try
        {
            var result = await _service.UpdateViolationAsync(raceId, violationId, refereeId, dto);
            return Ok(ApiResponse<ViolationDto>.Ok(result, "Violation updated."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<ViolationDto>.Fail(MapValidationMessage(ex.Message)));
        }
        catch (KeyNotFoundException ex) when (ex.Message is "RACE_NOT_FOUND" or "VIOLATION_NOT_FOUND" or "PLACE_BEHIND_ENTRY_NOT_FOUND")
        {
            return NotFound(ApiResponse<ViolationDto>.Fail("Violation or race entry was not found."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<ViolationDto>.Fail("Referee is not assigned to this race."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_LIVE")
        {
            return Conflict(ApiResponse<ViolationDto>.Fail("Violations can only be changed before unofficial results are submitted."));
        }
    }

    [HttpDelete("api/referees/races/{raceId:int}/violations/{violationId:int}")]
    [Authorize(Roles = "Referee")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteViolation(int raceId, int violationId)
    {
        if (!TryGetUserId(out var refereeId))
            return Unauthorized();

        try
        {
            await _service.DeleteViolationAsync(raceId, violationId, refereeId);
            return NoContent();
        }
        catch (KeyNotFoundException ex) when (ex.Message is "RACE_NOT_FOUND" or "VIOLATION_NOT_FOUND")
        {
            return NotFound(ApiResponse<object>.Fail("Violation was not found."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "REFEREE_NOT_ASSIGNED_TO_RACE")
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Referee is not assigned to this race."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_LIVE")
        {
            return Conflict(ApiResponse<object>.Fail("Violations can only be deleted before unofficial results are submitted."));
        }
    }

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
        "INVALID_VIOLATION_CODE" => "Mã vi phạm không nằm trong danh mục đã công bố.",
        "DESCRIPTION_REQUIRED" => "Vui lòng nhập mô tả vi phạm.",
        "INVALID_PENALTY" => "Hình thức xử phạt không hợp lệ (Disqualified/PlaceBehind/Warning/Scratch).",
        "PLACE_BEHIND_ENTRY_REQUIRED" => "Vui lòng chọn race entry bị xếp phía sau khi hình phạt là PlaceBehind.",
        "RESULTS_REQUIRED" => "Vui lòng nhập kết quả về đích.",
        "DUPLICATE_RACE_ENTRY_IN_RESULTS" => "Một race entry không được xuất hiện nhiều lần trong kết quả.",
        "RESULTS_MUST_INCLUDE_ALL_ELIGIBLE_ENTRIES" => "Phải nhập kết quả cho tất cả race entry hợp lệ.",
        "INVALID_STANDARD_RANKING" => "Thứ hạng không hợp lệ; cho phép đồng hạng theo dạng 1,1,3.",
        "INVALID_FINISH_POSITION" => "Thứ hạng về đích phải lớn hơn 0.",
        _ => "Dữ liệu không hợp lệ."
    };
}
