using HRTMS.Core.DTOs.Pairing;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[Tags("jockey")]
[ApiController]
[Route("api")]
public class PairingController : ControllerBase
{
    private readonly IPairingService _pairingService;

    public PairingController(IPairingService pairingService)
    {
        _pairingService = pairingService;
    }

    [HttpPost("pairings")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> CreatePairing(
        [FromBody] CreatePairingDto dto)
    {
        // Lay OwnerId tu JWT token
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var ownerId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Phiên đăng nhập không hợp lệ."
            });
        }

        try
        {
            var result = await _pairingService.CreateAsync(
                ownerId,
                dto);

            return CreatedAtAction(
                nameof(CreatePairing),
                new { id = result.PairingId },
                result);
        }
        catch (KeyNotFoundException ex)
    when (ex.Message == "HORSE_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "HORSE_NOT_FOUND",
                message = "Không tìm thấy hồ sơ ngựa."
            });
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "JOCKEY_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "JOCKEY_NOT_FOUND",
                message = "Không tìm thấy nài ngựa."
            });
        }
        catch (UnauthorizedAccessException ex)
            when (ex.Message == "HORSE_NOT_OWNED")
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new
                {
                    error = "HORSE_NOT_OWNED",
                    message = "Ngựa này không thuộc quyền sở hữu của bạn."
                });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "JOCKEY_NOT_ACTIVE")
        {
            return UnprocessableEntity(new
            {
                error = "JOCKEY_NOT_ACTIVE",
                message = "Nài ngựa hiện không hoạt động."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "HORSE_NOT_APPROVED")
        {
            return UnprocessableEntity(new
            {
                error = "HORSE_NOT_APPROVED",
                message = "Ngựa chưa được phê duyệt tham gia."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "HORSE_ALREADY_HAS_ACCEPTED_JOCKEY")
        {
            // Horse da co jockey accepted nen khong the tao loi moi moi
            return Conflict(new
            {
                error = "HORSE_ALREADY_HAS_ACCEPTED_JOCKEY",
                message = "Ngựa này đã có nài ngựa nhận ghép cặp."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "JOCKEY_ALREADY_HAS_ACCEPTED_HORSE")
        {
            // Jockey da co horse accepted nen khong the nhan them loi moi moi
            return Conflict(new
            {
                error = "JOCKEY_ALREADY_HAS_ACCEPTED_HORSE",
                message = "Nài ngựa này đã nhận ghép cặp với một ngựa khác."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "PAIRING_ALREADY_EXISTS")
        {
            // Cap horse-jockey nay da co pending hoac accepted nen khong tao trung
            return Conflict(new
            {
                error = "PAIRING_ALREADY_EXISTS",
                message = "Đã tồn tại lời mời ghép cặp đang chờ hoặc đã được chấp nhận cho ngựa và nài này."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "JOCKEY_ALREADY_HAS_ACTIVE_PAIRING")
        {
            return Conflict(new
            {
                error = "JOCKEY_ALREADY_HAS_ACTIVE_PAIRING",
                message = "Nài ngựa này đã có một ghép cặp đang hoạt động trong giải trùng lịch."
            });
        }
    }

    [HttpPatch("pairings/{id:int}/accept")]
    [Authorize(Roles = "Jockey")]
    public async Task<IActionResult> AcceptPairing(int id)
    {
        // Lay JockeyId tu JWT token
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var jockeyId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Phiên đăng nhập không hợp lệ."
            });
        }

        try
        {
            var result = await _pairingService.AcceptAsync(
                jockeyId,
                id);

            return Ok(result);
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "PAIRING_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "PAIRING_NOT_FOUND",
                message = "Không tìm thấy cặp thi đấu."
            });
        }
        catch (UnauthorizedAccessException ex)
            when (ex.Message == "FORBIDDEN")
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new
                {
                    error = "FORBIDDEN",
                    message = "Bạn không có quyền chấp nhận lời mời ghép cặp này."
                });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "HORSE_ALREADY_ACCEPTED")
        {
            return Conflict(new
            {
                error = "HORSE_ALREADY_ACCEPTED",
                message = "Ngựa này đã có nài ngựa nhận ghép cặp."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "HORSE_NOT_APPROVED")
        {
            return UnprocessableEntity(new
            {
                error = "HORSE_NOT_APPROVED",
                message = "Ngựa đang chờ Ban tổ chức phê duyệt."
            });
        }
    }

    [HttpPatch("pairings/{id:int}/decline")]
    [Authorize(Roles = "Jockey")]
    public async Task<IActionResult> DeclinePairing(
        int id,
        [FromBody] DeclinePairingDto dto)
    {
        // Lay JockeyId tu JWT token
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var jockeyId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Phiên đăng nhập không hợp lệ."
            });
        }

        try
        {
            var result = await _pairingService.DeclineAsync(
                jockeyId,
                id,
                dto);

            return Ok(result);
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "PAIRING_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "PAIRING_NOT_FOUND",
                message = "Không tìm thấy cặp thi đấu."
            });
        }
        catch (UnauthorizedAccessException ex)
            when (ex.Message == "FORBIDDEN")
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new
                {
                    error = "FORBIDDEN",
                    message = "Bạn không có quyền từ chối lời mời ghép cặp này."
                });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "INVALID_STATUS")
        {
            return Conflict(new
            {
                error = "INVALID_STATUS",
                message = "Chỉ có thể từ chối lời mời đang chờ phản hồi."
            });
        }
    }

    [HttpGet("owner/pairings")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> GetOwnerPairings(
        [FromQuery] string? status,
        [FromQuery] int? horseId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        // Lay OwnerId tu JWT token
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var ownerId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Phiên đăng nhập không hợp lệ."
            });
        }

        try
        {
            var result = await _pairingService
                .GetOwnerPairingsAsync(
                    ownerId,
                    status,
                    horseId,
                    page,
                    pageSize);

            return Ok(result);
        }
        catch (ArgumentException ex)
            when (ex.Message == "INVALID_PAIRING_STATUS")
        {
            return BadRequest(new
            {
                error = "VALIDATION_ERROR",
                message = "Trạng thái lọc không hợp lệ."
            });
        }
    }

    // Module E — Admin liet ke pairing de allocate vao Race (allocation picker).
    [HttpGet("admin/pairings")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAdminPairings(
        [FromQuery] int targetRaceId,
        [FromQuery] int? tournamentId,
        [FromQuery] string? status,
        [FromQuery] bool unallocatedOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (targetRaceId <= 0)
        {
            return BadRequest(new
            {
                error = "TARGET_RACE_REQUIRED",
                message = "Cần chọn race đích để lấy pairing đủ điều kiện."
            });
        }

        try
        {
            var result = await _pairingService.GetAdminPairingsAsync(
                targetRaceId,
                tournamentId,
                status,
                unallocatedOnly,
                page,
                pageSize);

            return Ok(result);
        }
        catch (ArgumentException ex) when (ex.Message == "INVALID_PAIRING_STATUS")
        {
            return BadRequest(new
            {
                error = "VALIDATION_ERROR",
                message = "Trạng thái lọc không hợp lệ."
            });
        }
        catch (ArgumentException ex) when (ex.Message == "TARGET_RACE_TOURNAMENT_MISMATCH")
        {
            return BadRequest(new
            {
                error = "TARGET_RACE_TOURNAMENT_MISMATCH",
                message = "Race được chọn không thuộc tournament đang xem."
            });
        }
        catch (KeyNotFoundException ex) when (ex.Message == "TARGET_RACE_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "TARGET_RACE_NOT_FOUND",
                message = "Không tìm thấy race cần allocate pairing."
            });
        }
    }

    [HttpPatch("pairings/{id:int}/confirm")]
    [Authorize(Roles = "Owner")]
    public async Task<IActionResult> Confirm(int id)
    {
        // Lay OwnerId tu JWT token
        var userIdValue = User.FindFirstValue(
            ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out var ownerId))
        {
            return Unauthorized(new
            {
                error = "UNAUTHORIZED",
                message = "Phiên đăng nhập không hợp lệ."
            });
        }

        try
        {
            var result = await _pairingService.ConfirmAsync(
                ownerId,
                id);

            return Ok(result);
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "PAIRING_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "PAIRING_NOT_FOUND",
                message = "Không tìm thấy cặp thi đấu."
            });
        }
        catch (UnauthorizedAccessException ex)
            when (ex.Message == "HORSE_NOT_OWNED")
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new
                {
                    error = "HORSE_NOT_OWNED",
                    message = "Ngựa này không thuộc quyền sở hữu của bạn."
                });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "INVALID_STATUS")
        {
            return Conflict(new
            {
                error = "INVALID_STATUS",
                message = "Chỉ có thể xác nhận cặp đã được nài ngựa chấp nhận."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "HORSE_NOT_APPROVED")
        {
            return UnprocessableEntity(new
            {
                error = "HORSE_NOT_APPROVED",
                message = "Ngựa đang chờ Ban tổ chức phê duyệt."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "JOCKEY_NOT_ACTIVE")
        {
            return UnprocessableEntity(new
            {
                error = "JOCKEY_NOT_ACTIVE",
                message = "Nài ngựa hiện không hoạt động."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "JOCKEY_NOT_APPROVED_FOR_TOURNAMENT")
        {
            return UnprocessableEntity(new
            {
                error = "JOCKEY_NOT_APPROVED_FOR_TOURNAMENT",
                message = "Nài ngựa chưa được phê duyệt tham gia giải đấu này."
            });
        }
    }
    [HttpPatch("pairings/{id:int}/cancel")]
[Authorize(Roles = "Owner")]
public async Task<IActionResult> CancelPairing(int id)
{
    // Lay OwnerId tu JWT token
    var userIdValue = User.FindFirstValue(
        ClaimTypes.NameIdentifier);

    if (!int.TryParse(userIdValue, out var ownerId))
    {
        return Unauthorized(new
        {
            error = "UNAUTHORIZED",
            message = "Phiên đăng nhập không hợp lệ."
        });
    }

    try
    {
        var result = await _pairingService.CancelAsync(
            ownerId,
            id);

        return Ok(result);
    }
    catch (KeyNotFoundException ex)
        when (ex.Message == "PAIRING_NOT_FOUND")
    {
        return NotFound(new
        {
            error = "PAIRING_NOT_FOUND",
            message = "Không tìm thấy cặp thi đấu."
        });
    }
    catch (UnauthorizedAccessException ex)
        when (ex.Message == "HORSE_NOT_OWNED")
    {
        return StatusCode(
            StatusCodes.Status403Forbidden,
            new
            {
                error = "HORSE_NOT_OWNED",
                message = "Ngựa này không thuộc quyền sở hữu của bạn."
            });
    }
    catch (InvalidOperationException ex)
        when (ex.Message == "INVALID_STATUS")
    {
        return Conflict(new
        {
            error = "INVALID_STATUS",
            message = "Chỉ có thể hủy lời mời đang chờ phản hồi hoặc đã được chấp nhận."
        });
    }
}
}
