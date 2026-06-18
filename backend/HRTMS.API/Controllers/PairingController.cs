using HRTMS.Core.DTOs.Pairing;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

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
                message = "Invalid or missing user identity."
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
                message = "Horse was not found."
            });
        }
        catch (KeyNotFoundException ex)
            when (ex.Message == "JOCKEY_NOT_FOUND")
        {
            return NotFound(new
            {
                error = "JOCKEY_NOT_FOUND",
                message = "Jockey was not found."
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
                    message = "The horse does not belong to the current owner."
                });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "PAIRING_ALREADY_EXISTS")
        {
            return Conflict(new
            {
                error = "PAIRING_ALREADY_EXISTS",
                message = "A pending or accepted pairing already exists."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "JOCKEY_NOT_ACTIVE")
        {
            return UnprocessableEntity(new
            {
                error = "JOCKEY_NOT_ACTIVE",
                message = "The jockey is not active."
            });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "HORSE_NOT_APPROVED")
        {
            return UnprocessableEntity(new
            {
                error = "HORSE_NOT_APPROVED",
                message = "The horse has not been approved."
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
                message = "Invalid or missing user identity."
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
                message = "Pairing was not found."
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
                    message = "You are not allowed to accept this pairing."
                });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "HORSE_ALREADY_ACCEPTED")
        {
            return Conflict(new
            {
                error = "HORSE_ALREADY_ACCEPTED",
                message = "This horse already has an accepted jockey."
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
                message = "Invalid or missing user identity."
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
                message = "Pairing was not found."
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
                    message = "You are not allowed to decline this pairing."
                });
        }
        catch (InvalidOperationException ex)
            when (ex.Message == "INVALID_STATUS")
        {
            return Conflict(new
            {
                error = "INVALID_STATUS",
                message = "Only pending pairings can be declined."
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
                message = "Invalid or missing user identity."
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
                message = "Status must be Pending, Accepted, or Declined."
            });
        }
    }
}