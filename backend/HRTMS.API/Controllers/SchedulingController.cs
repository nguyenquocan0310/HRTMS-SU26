using HRTMS.Core.DTOs.RaceEntry;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

// Module E — Lập lịch, Bốc thăm & Rút lui.
// Tách riêng khỏi RaceEntryController (vốn phục vụ Owner đăng ký entry + entry fee).
[Tags("scheduling")]
[ApiController]
[Route("api")]
public class SchedulingController : ControllerBase
{
    private readonly IRaceEntryService _service;

    public SchedulingController(IRaceEntryService service)
    {
        _service = service;
    }

    // Admin phân bổ Pairing vào Race.
    [HttpPost("admin/races/{raceId:int}/entries")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Allocate(int raceId, [FromBody] AllocateEntryDto dto)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.AllocateAsync(adminId, raceId, dto);
            // Lich cong khai xem qua GET /api/races/{raceId}/entries (TournamentController - Module B).
            return Created($"/api/races/{raceId}/entries", result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(Err("RACE_NOT_FOUND", "Không tìm thấy cuộc đua."));
        }
        catch (KeyNotFoundException ex) when (ex.Message == "PAIRING_NOT_FOUND")
        {
            return NotFound(Err("PAIRING_NOT_FOUND", "Không tìm thấy cặp đấu."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ALREADY_DRAWN")
        {
            return Conflict(Err("RACE_ALREADY_DRAWN", "Cuộc đua đã bốc thăm vị trí xuất phát nên không thể thêm ngựa."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "INVALID_RACE_STATE")
        {
            return UnprocessableEntity(Err("INVALID_RACE_STATE", "Cuộc đua hiện không cho phép xếp ngựa vào."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "TOURNAMENT_NOT_OPEN_FOR_SCHEDULING")
        {
            return UnprocessableEntity(Err("TOURNAMENT_NOT_OPEN_FOR_SCHEDULING",
                "Giải đấu chưa mở đăng ký hoặc đã kết thúc nên không thể xếp lịch thi đấu."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PAIRING_TOURNAMENT_MISMATCH")
        {
            return UnprocessableEntity(Err("PAIRING_TOURNAMENT_MISMATCH", "Cặp đấu không thuộc giải đấu của cuộc đua này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PAIRING_NOT_CONFIRMED")
        {
            return UnprocessableEntity(Err("PAIRING_NOT_CONFIRMED", "Chỉ cặp đấu đã xác nhận mới được xếp vào cuộc đua."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PREVIOUS_ROUND_NOT_COMPLETED")
        {
            return UnprocessableEntity(Err("PREVIOUS_ROUND_NOT_COMPLETED",
                "Vòng đấu trước chưa hoàn tất nên chưa thể xếp ngựa vào vòng này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PAIRING_NOT_QUALIFIED")
        {
            return UnprocessableEntity(Err("PAIRING_NOT_QUALIFIED",
                "Cặp đấu chưa đủ điều kiện đi tiếp từ vòng trước nên không thể xếp vào vòng này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "HORSE_NOT_APPROVED_IN_TOURNAMENT")
        {
            return UnprocessableEntity(Err("HORSE_NOT_APPROVED_IN_TOURNAMENT",
                "Ngựa chưa được duyệt tham gia giải này (duyệt theo từng giải)."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "JOCKEY_EXPERIENCE_TOO_LOW")
        {
            return UnprocessableEntity(Err("JOCKEY_EXPERIENCE_TOO_LOW",
                "Nài ngựa chưa đủ số năm kinh nghiệm mà giải yêu cầu."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "MAX_HORSES_REACHED")
        {
            return Conflict(Err("MAX_HORSES_REACHED", "Cuộc đua đã đủ số ngựa tối đa."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "DUPLICATE_IN_RACE")
        {
            return Conflict(Err("DUPLICATE_IN_RACE", "Ngựa hoặc nài này đã có trong cuộc đua."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "DOUBLE_BOOKED")
        {
            return Conflict(Err("DOUBLE_BOOKED", "Ngựa hoặc nài này đã có mặt ở một cuộc đua khác cùng giờ."));
        }
        catch (InvalidOperationException ex) when (ex.Message is "RACE_IN_PAST" or "RACE_OUT_OF_WINDOW" or "RACE_BEFORE_ROUND")
        {
            return UnprocessableEntity(Err("INVALID_SCHEDULE", "Lịch cuộc đua nằm ngoài khoảng thời gian hợp lệ."));
        }
    }

    // Admin chốt danh sách và tự động phân toàn bộ pool vào các race của vòng.
    // Thay cho việc click allocate từng pairing ở case thông thường.
    [HttpPost("admin/rounds/{roundId:int}/auto-allocate")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AutoAllocate(int roundId)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.AutoAllocateRoundAsync(adminId, roundId);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(Err("ROUND_NOT_FOUND", "Không tìm thấy vòng đấu."));
        }
        catch (InvalidOperationException ex)
        {
            return MapAllocateError(ex.Message);
        }
    }

    // Preview (dry-run) trước khi chốt — KHÔNG ghi DB.
    // Trả danh sách được chọn, danh sách chờ, số ngựa mỗi race và cảnh báo.
    // `assignmentIsFinal = false`: ngựa nào vào race nào chỉ chốt ở bước thật.
    [HttpPost("admin/rounds/{roundId:int}/auto-allocate/preview")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PreviewAutoAllocate(int roundId)
    {
        try
        {
            var result = await _service.PreviewAllocateRoundAsync(roundId);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(Err("ROUND_NOT_FOUND", "Không tìm thấy vòng đấu."));
        }
        catch (InvalidOperationException ex)
        {
            return MapAllocateError(ex.Message);
        }
    }

    // Danh sách chờ đã lưu của một vòng (bảng RoundWaitlist).
    [HttpGet("admin/rounds/{roundId:int}/waitlist")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetWaitlist(int roundId)
    {
        try
        {
            return Ok(await _service.GetRoundWaitlistAsync(roundId));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(Err("ROUND_NOT_FOUND", "Không tìm thấy vòng đấu."));
        }
    }

    // Admin điều chỉnh thủ công sau auto-allocate: chuyển entry sang race khác
    // TRONG CÙNG vòng.
    [HttpPut("admin/race-entries/{id:int}/move")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MoveEntry(int id, [FromBody] MoveEntryDto dto)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.MoveEntryAsync(adminId, id, dto.TargetRaceId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "ENTRY_NOT_FOUND")
        {
            return NotFound(Err("ENTRY_NOT_FOUND", "Không tìm thấy đăng ký cuộc đua."));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(Err("TARGET_RACE_NOT_FOUND", "Không tìm thấy cuộc đua đích."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "MAX_LANES_REACHED")
        {
            return Conflict(Err("MAX_LANES_REACHED",
                "Cuộc đua đích đã kín làn xuất phát."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PAIRING_FEE_NOT_PAID")
        {
            return UnprocessableEntity(Err("PAIRING_FEE_NOT_PAID",
                "Cặp đấu chưa được xác nhận lệ phí nên không thể xếp vào cuộc đua."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_IN_SAME_ROUND")
        {
            return UnprocessableEntity(Err("RACE_NOT_IN_SAME_ROUND",
                "Chỉ có thể chuyển sang cuộc đua khác trong cùng vòng đấu."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "ALREADY_DRAWN")
        {
            return Conflict(Err("ALREADY_DRAWN",
                "Cuộc đua đã bốc thăm nên không thể chuyển ngựa."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "DUPLICATE_IN_RACE")
        {
            return Conflict(Err("DUPLICATE_IN_RACE", "Ngựa hoặc nài này đã có trong cuộc đua đích."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "SAME_RACE")
        {
            return UnprocessableEntity(Err("SAME_RACE", "Đăng ký đã ở cuộc đua này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "INVALID_STATUS")
        {
            return Conflict(Err("INVALID_STATUS", "Đăng ký không còn hiệu lực nên không thể chuyển."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "INVALID_RACE_STATE")
        {
            return UnprocessableEntity(Err("INVALID_RACE_STATE", "Cuộc đua đích không cho phép xếp ngựa vào."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "TOURNAMENT_NOT_OPEN_FOR_SCHEDULING")
        {
            return UnprocessableEntity(Err("TOURNAMENT_NOT_OPEN_FOR_SCHEDULING",
                "Giải đấu chưa mở đăng ký hoặc đã kết thúc nên không thể xếp lịch thi đấu."));
        }
    }

    // Admin chốt vòng: phân race + bốc thăm toàn bộ race đủ điều kiện.
    // KHÔNG phải một transaction duy nhất: allocate là một transaction, mỗi draw
    // là một transaction riêng. Race không bốc được nằm trong skippedDraws kèm
    // lý do; phần đã làm xong KHÔNG bị rollback. Gọi lại endpoint này an toàn.
    [HttpPost("admin/rounds/{roundId:int}/finalize")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> FinalizeRound(int roundId)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.FinalizeRoundAsync(adminId, roundId);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(Err("ROUND_NOT_FOUND", "Không tìm thấy vòng đấu."));
        }
        catch (InvalidOperationException ex)
        {
            return MapAllocateError(ex.Message);
        }
    }

    // Admin bốc thăm vị trí xuất phát (nguyên tử).
    [HttpPost("admin/races/{raceId:int}/draw")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Draw(int raceId)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.DrawPostPositionsAsync(adminId, raceId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(Err("RACE_NOT_FOUND", "Không tìm thấy cuộc đua."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "ALREADY_DRAWN")
        {
            return Conflict(Err("ALREADY_DRAWN", "Cuộc đua này đã bốc thăm vị trí xuất phát rồi."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "NO_ELIGIBLE_ENTRIES")
        {
            return UnprocessableEntity(Err("NO_ELIGIBLE_ENTRIES", "Chưa có ngựa hợp lệ để bốc thăm."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "NOT_ENOUGH_ENTRIES")
        {
            return UnprocessableEntity(Err("NOT_ENOUGH_ENTRIES",
                "Cuộc đua cần ít nhất 2 ngựa hợp lệ mới bốc thăm được."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "ENTRIES_NOT_ALL_CONFIRMED")
        {
            return UnprocessableEntity(Err("ENTRIES_NOT_ALL_CONFIRMED",
                "Còn đăng ký chưa được xác nhận nên chưa thể chốt danh sách xuất phát."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "MAX_LANES_REACHED")
        {
            return Conflict(Err("MAX_LANES_REACHED",
                "Số ngựa hợp lệ vượt quá số làn xuất phát của sân đua."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "TOURNAMENT_NOT_OPEN_FOR_SCHEDULING")
        {
            return UnprocessableEntity(Err("TOURNAMENT_NOT_OPEN_FOR_SCHEDULING",
                "Giải đấu chưa mở đăng ký hoặc đã kết thúc nên không thể bốc thăm."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "DRAW_CONFLICT")
        {
            return Conflict(Err("DRAW_CONFLICT", "Có xung đột khi bốc thăm đồng thời. Vui lòng thử lại."));
        }
    }

    // Lịch thi đấu công khai đã có sẵn: GET /api/races/{raceId}/entries
    // (TournamentController - Module B). Service vẫn expose GetRaceScheduleAsync để tái sử dụng nếu cần.

    // Owner xác nhận tham gia.
    [HttpPatch("race-entries/{id:int}/confirm")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> Confirm(int id)
    {
        if (!TryGetUserId(out var ownerId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.ConfirmAsync(ownerId, id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "ENTRY_NOT_FOUND")
        {
            return NotFound(Err("ENTRY_NOT_FOUND", "Không tìm thấy đăng ký cuộc đua."));
        }
        catch (UnauthorizedAccessException ex) when (ex.Message == "FORBIDDEN")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                Err("FORBIDDEN", "Bạn không có quyền xác nhận đăng ký này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "INVALID_STATUS")
        {
            return Conflict(Err("INVALID_STATUS", "Chỉ đăng ký đang chờ mới có thể xác nhận."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "ENTRY_FEE_NOT_PAID")
        {
            return UnprocessableEntity(Err("ENTRY_FEE_NOT_PAID",
                "Lệ phí tham gia chưa được Ban tổ chức xác nhận nên chưa thể xác nhận tham gia."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "HORSE_NOT_APPROVED_IN_TOURNAMENT")
        {
            return UnprocessableEntity(Err("HORSE_NOT_APPROVED_IN_TOURNAMENT",
                "Ngựa không còn được duyệt tham gia giải này nên không thể xác nhận."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "CONFIRMATION_CLOSED")
        {
            return UnprocessableEntity(Err("CONFIRMATION_CLOSED", "Đã quá hạn xác nhận tham gia."));
        }
    }

    // Owner rút lui (Withdrawal Flow, idempotent).
    // DELETE theo contract; lý do (tùy chọn) truyền qua query: ?reason=...
    [HttpDelete("race-entries/{id:int}")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> Withdraw(int id, [FromQuery] string? reason)
    {
        if (!TryGetUserId(out var ownerId))
            return UnauthorizedResult();

        try
        {
            var dto = new WithdrawEntryDto { Reason = reason };
            var result = await _service.WithdrawAsync(ownerId, id, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "ENTRY_NOT_FOUND")
        {
            return NotFound(Err("ENTRY_NOT_FOUND", "Không tìm thấy đăng ký cuộc đua."));
        }
        catch (UnauthorizedAccessException ex) when (ex.Message == "FORBIDDEN")
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                Err("FORBIDDEN", "Bạn không có quyền rút đăng ký này."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UPCOMING")
        {
            return UnprocessableEntity(Err("RACE_NOT_UPCOMING",
                "Cuộc đua đã bắt đầu hoặc kết thúc nên không thể rút đăng ký."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "LATE_WITHDRAW_REASON_REQUIRED")
        {
            return BadRequest(Err("LATE_WITHDRAW_REASON_REQUIRED",
                "Rút lui sau Pre-Race phải nêu lý do ít nhất 10 ký tự."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "WITHDRAW_AFTER_CUTOFF")
        {
            return UnprocessableEntity(Err("WITHDRAW_AFTER_CUTOFF",
                "Đã quá hạn chốt xác nhận. Vui lòng liên hệ Ban tổ chức để rút đăng ký."));
        }
    }

    // (Admin) Admin hủy race entry thay mặt Owner (điều phối khẩn cấp).
    // Dùng lại WithdrawAsync với isSystem:true để bỏ qua check quyền sở hữu Owner.
    [HttpDelete("admin/race-entries/{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminCancel(int id, [FromQuery] string? reason)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var dto = new WithdrawEntryDto
            {
                Reason = string.IsNullOrWhiteSpace(reason) ? "Ban tổ chức điều phối" : reason
            };
            var result = await _service.WithdrawAsync(adminId, id, dto, isSystem: true);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "ENTRY_NOT_FOUND")
        {
            return NotFound(Err("ENTRY_NOT_FOUND", "Không tìm thấy đăng ký cuộc đua."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_NOT_UPCOMING")
        {
            return UnprocessableEntity(Err("RACE_NOT_UPCOMING",
                "Cuộc đua đã bắt đầu hoặc kết thúc nên không thể hủy đăng ký."));
        }
    }

    // (Admin) Hủy một cuộc đua chưa Official (SCH.9 — nhánh hủy race).
    // Entry active đi qua withdraw-flow: fee Refund Pending, hoàn điểm dự đoán,
    // giải phóng cổng xuất phát, notification — tất cả trong một transaction.
    [HttpPatch("races/{id:int}/cancel")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CancelRace(int id, [FromQuery] string? reason)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.CancelRaceAsync(adminId, id, reason);
            return Ok(result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "RACE_NOT_FOUND")
        {
            return NotFound(Err("RACE_NOT_FOUND", "Không tìm thấy cuộc đua."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ALREADY_OFFICIAL")
        {
            return Conflict(Err("RACE_ALREADY_OFFICIAL",
                "Cuộc đua đã công bố kết quả chính thức, không thể hủy."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "RACE_ALREADY_CANCELLED")
        {
            return Conflict(Err("RACE_ALREADY_CANCELLED", "Cuộc đua này đã bị hủy trước đó."));
        }
    }

    // ---------------- helpers ----------------

    // Mã lỗi auto-allocate dùng chung cho /auto-allocate và /finalize.
    private IActionResult MapAllocateError(string code) => code switch
    {
        "ROUND_ALREADY_ALLOCATED" => Conflict(Err(code,
            "Vòng đấu này đã được phân ngựa vào cuộc đua rồi.")),
        "ROUND_ALREADY_DRAWN" => Conflict(Err(code,
            "Vòng đấu này đã bốc thăm nên không thể phân lại.")),
        "NO_RACES_IN_ROUND" => UnprocessableEntity(Err(code,
            "Vòng đấu chưa có cuộc đua nào để phân ngựa.")),
        "NO_ELIGIBLE_PAIRINGS" => UnprocessableEntity(Err(code,
            "Chưa có cặp đấu nào đủ điều kiện (đã xác nhận lệ phí) để phân vào cuộc đua.")),
        "INSUFFICIENT_PAIRINGS_FOR_RACES" => UnprocessableEntity(Err(code,
            "Số cặp đủ điều kiện không đủ cho số cuộc đua của vòng — mỗi cuộc đua cần ít nhất " +
            "2 ngựa mới bốc thăm được. Hãy giảm bớt số cuộc đua của vòng, hoặc chờ thêm cặp " +
            "hoàn tất lệ phí rồi phân lại.")),
        "RACE_CAPACITY_TOO_SMALL" => UnprocessableEntity(Err(code,
            "Số ngựa tối đa mỗi cuộc đua đang là 1 nên không cuộc đua nào bốc thăm được. " +
            "Hãy tăng số ngựa tối đa của giải lên ít nhất 2.")),
        "PREVIOUS_ROUND_NOT_COMPLETED" => UnprocessableEntity(Err(code,
            "Vòng đấu trước chưa hoàn tất nên chưa thể phân ngựa vào vòng này.")),
        "VENUE_REQUIRED" => UnprocessableEntity(Err(code,
            "Giải đấu chưa được gán sân đua nên không xác định được số làn xuất phát.")),
        "TOURNAMENT_NOT_OPEN_FOR_SCHEDULING" => UnprocessableEntity(Err(code,
            "Giải đấu chưa mở đăng ký hoặc đã kết thúc nên không thể xếp lịch thi đấu.")),
        _ => UnprocessableEntity(Err(code, code))
    };

    private bool TryGetUserId(out int userId)
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out userId);
    }

    private IActionResult UnauthorizedResult() =>
        Unauthorized(Err("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ."));

    private static object Err(string error, string message) => new { error, message };
}
