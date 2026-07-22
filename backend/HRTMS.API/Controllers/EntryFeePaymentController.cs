using HRTMS.Core.DTOs.Payment;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

// Module E/N — Nộp & đối chiếu lệ phí (patch 013).
// Owner nộp -> Pairing PendingVerification -> Admin verify -> Pairing Confirmed.
[Tags("fee-payments")]
[ApiController]
[Route("api")]
[Authorize]
public class EntryFeePaymentController : ControllerBase
{
    private static readonly FileExtensionContentTypeProvider ContentTypeProvider = new();

    private readonly IEntryFeePaymentService _service;

    public EntryFeePaymentController(IEntryFeePaymentService service)
    {
        _service = service;
    }

    // Owner nộp lệ phí cho một cặp đấu. multipart/form-data vì kèm file chứng từ.
    [HttpPost("pairings/{id:int}/fee-payment")]
    [Authorize(Roles = "Owner")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Submit(
        int id, [FromForm] SubmitFeePaymentDto dto, IFormFile? proofFile)
    {
        if (!TryGetUserId(out var ownerId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.SubmitAsync(ownerId, id, dto, proofFile);
            return Created($"/api/fee-payments/{result.PaymentId}", result);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "PAIRING_NOT_FOUND")
        {
            return NotFound(Err("PAIRING_NOT_FOUND", "Không tìm thấy cặp đấu."));
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                Err("FORBIDDEN", "Bạn không có quyền nộp lệ phí cho cặp đấu này."));
        }
        catch (ArgumentException ex)
        {
            // Lỗi validate file (định dạng/kích thước) từ FileStorageService.
            return BadRequest(Err("INVALID_PROOF_FILE", ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return MapSubmitError(ex.Message);
        }
    }

    // Admin: danh sách hồ sơ lệ phí để đối chiếu.
    [HttpGet("admin/fee-payments")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetForAdmin(
        [FromQuery] string? status,
        [FromQuery] int? tournamentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _service.GetForAdminAsync(status, tournamentId, page, pageSize);
        return Ok(result);
    }

    [HttpPost("admin/fee-payments/{id:int}/verify")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Verify(int id)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.VerifyAsync(adminId, id);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(Err(ex.Message, "Không tìm thấy hồ sơ lệ phí."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PAYMENT_ALREADY_VERIFIED")
        {
            return Conflict(Err("PAYMENT_ALREADY_VERIFIED", "Hồ sơ lệ phí này đã được xác nhận trước đó."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PAYMENT_NOT_PENDING")
        {
            return Conflict(Err("PAYMENT_NOT_PENDING", "Hồ sơ lệ phí không còn ở trạng thái chờ đối chiếu."));
        }
    }

    [HttpPost("admin/fee-payments/{id:int}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(int id, [FromBody] RejectFeePaymentDto dto)
    {
        if (!TryGetUserId(out var adminId))
            return UnauthorizedResult();

        try
        {
            var result = await _service.RejectAsync(adminId, id, dto.Reason);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(Err(ex.Message, "Không tìm thấy hồ sơ lệ phí."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "REJECT_REASON_REQUIRED")
        {
            return BadRequest(Err("REJECT_REASON_REQUIRED", "Phải nêu lý do từ chối, ít nhất 10 ký tự."));
        }
        catch (InvalidOperationException ex) when (ex.Message == "PAYMENT_NOT_PENDING")
        {
            return Conflict(Err("PAYMENT_NOT_PENDING", "Hồ sơ lệ phí không còn ở trạng thái chờ đối chiếu."));
        }
    }

    // Tải chứng từ — chỉ Admin hoặc chính Owner của cặp đấu.
    [HttpGet("fee-payments/{id:int}/proof")]
    public async Task<IActionResult> GetProof(int id)
    {
        if (!TryGetUserId(out var actorId))
            return UnauthorizedResult();

        try
        {
            var (physicalPath, fileName) =
                await _service.GetProofAsync(actorId, User.IsInRole("Admin"), id);

            if (!ContentTypeProvider.TryGetContentType(physicalPath, out var contentType))
                contentType = "application/octet-stream";

            var stream = System.IO.File.OpenRead(physicalPath);
            return File(stream, contentType, fileName);
        }
        catch (KeyNotFoundException ex) when (ex.Message == "PROOF_NOT_FOUND")
        {
            return NotFound(Err("PROOF_NOT_FOUND", "Hồ sơ này không có chứng từ đính kèm."));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(Err("PAYMENT_NOT_FOUND", "Không tìm thấy hồ sơ lệ phí."));
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                Err("FORBIDDEN", "Bạn không có quyền xem chứng từ này."));
        }
    }

    // ---------------- helpers ----------------

    private IActionResult MapSubmitError(string code) => code switch
    {
        "PAIRING_NOT_ACCEPTED" => UnprocessableEntity(Err(code,
            "Cặp đấu chưa ở trạng thái cho phép nộp lệ phí (nài ngựa phải chấp nhận trước).")),
        "TOURNAMENT_IS_FREE" => UnprocessableEntity(Err(code,
            "Giải đấu này miễn lệ phí nên không cần nộp.")),
        "PAYMENT_DEADLINE_PASSED" => UnprocessableEntity(Err(code,
            "Đã quá hạn nộp lệ phí của giải đấu.")),
        "INVALID_PAYMENT_METHOD" => BadRequest(Err(code,
            "Hình thức thanh toán không hợp lệ. Chỉ chấp nhận Cash hoặc Transfer.")),
        "RECEIPT_NO_REQUIRED" => BadRequest(Err(code,
            "Nộp tiền mặt phải kèm số biên lai.")),
        "TRANSFER_REF_REQUIRED" => BadRequest(Err(code,
            "Chuyển khoản phải kèm mã giao dịch.")),
        "ACTIVE_PAYMENT_EXISTS" => Conflict(Err(code,
            "Cặp đấu này đã có hồ sơ lệ phí đang chờ đối chiếu hoặc đã được xác nhận.")),
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
