using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Horse;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HRTMS.API.Controllers;

[ApiController]
[Route("api/race-entries")]
[Authorize]
public class RaceEntryController : ControllerBase
{
    private readonly IHorseService _horseService;

    public RaceEntryController(IHorseService horseService)
    {
        _horseService = horseService;
    }

    private int CurrentUserId =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // RaceEntry chi do Admin tao qua SCH.1 (POST /api/admin/races/{raceId}/entries).
    // Owner chi khai bao ngua + moi jockey; khong tu tao RaceEntry.
    // Endpoint nay chi de Owner xem cac entry cua minh.

    [HttpGet("my")]
    [Authorize(Roles = "Owner")]
    [ProducesResponseType(typeof(ApiResponse<List<RaceEntryResponseDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyRaceEntries(
        [FromQuery] string? status,
        [FromQuery] string? entryFeeStatus,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var result = await _horseService.GetMyRaceEntriesAsync(
            CurrentUserId, status, entryFeeStatus, page, pageSize);
        return Ok(result);
    }
}