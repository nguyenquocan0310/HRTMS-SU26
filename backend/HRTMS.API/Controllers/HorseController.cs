using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Horse;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.API.Controllers
{

    [Tags("horse")]
    [ApiController]
    [Route("api/horses")]
    public class HorseController : ControllerBase
    {
        private readonly IHorseService _horseService;

        public HorseController(IHorseService horseService)
        {
            _horseService = horseService;
        }

        private int CurrentUserId =>
            int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpPost]
        [Authorize(Roles = "Owner")]
        [ProducesResponseType(typeof(ApiResponse<HorseResponseDto>), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> CreateHorse([FromBody] CreateHorseDto dto)
        {
            var result = await _horseService.CreateHorseAsync(CurrentUserId, dto);
            if (!result.Success) return BadRequest(result);
            return CreatedAtAction(nameof(GetHorseById), new { id = result.Data!.HorseId }, result);
        }

        [HttpGet("my")]
        [Authorize(Roles = "Owner")]
        [ProducesResponseType(typeof(ApiResponse<List<HorseResponseDto>>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetMyHorses(
            [FromQuery] string? adminApprovalStatus,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _horseService.GetMyHorsesAsync(CurrentUserId, adminApprovalStatus, page, pageSize);
            return Ok(result);
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "Owner")]
        [ProducesResponseType(typeof(ApiResponse<HorseResponseDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetHorseById(int id)
        {
            var result = await _horseService.GetHorseByIdAsync(CurrentUserId, id);
            if (!result.Success) return result.Message.Contains("NOT_FOUND") ? NotFound(result) : Forbid();
            return Ok(result);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Owner")]
        [ProducesResponseType(typeof(ApiResponse<HorseResponseDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateHorse(int id, [FromBody] UpdateHorseDto dto)
        {
            var result = await _horseService.UpdateHorseAsync(CurrentUserId, id, dto);
            if (!result.Success) return result.Message.Contains("NOT_FOUND") ? NotFound(result) : Forbid();
            return Ok(result);
        }

        // ── Enrollment: đẩy ngựa trong kho vào một giải ───────────────────────

        [HttpPost("{horseId:int}/enrollments")]
        [Authorize(Roles = "Owner")]
        [ProducesResponseType(typeof(ApiResponse<HorseEnrollmentResponseDto>), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> EnrollHorse(int horseId, [FromBody] EnrollHorseDto dto)
        {
            var result = await _horseService.EnrollHorseAsync(CurrentUserId, horseId, dto);
            if (!result.Success)
            {
                if (result.Message.Contains("NOT_FOUND")) return NotFound(result);
                if (result.Message.Contains("NOT_OWNED")) return Forbid();
                return BadRequest(result);
            }
            return CreatedAtAction(nameof(GetHorseEnrollments), new { horseId }, result);
        }

        [HttpGet("{horseId:int}/enrollments")]
        [Authorize(Roles = "Owner")]
        [ProducesResponseType(typeof(ApiResponse<List<HorseEnrollmentResponseDto>>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetHorseEnrollments(
            int horseId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _horseService.GetMyEnrollmentsAsync(CurrentUserId, horseId, null, page, pageSize);
            return Ok(result);
        }

        [HttpGet("my/enrollments")]
        [Authorize(Roles = "Owner")]
        [ProducesResponseType(typeof(ApiResponse<List<HorseEnrollmentResponseDto>>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetMyEnrollments(
            [FromQuery] int? tournamentId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var result = await _horseService.GetMyEnrollmentsAsync(CurrentUserId, null, tournamentId, page, pageSize);
            return Ok(result);
        }
    }
}