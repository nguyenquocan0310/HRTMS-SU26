using HRTMS.Core.DTOs.Horse;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.API.Controllers
{
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
        public async Task<IActionResult> CreateHorse([FromBody] CreateHorseDto dto)
        {
            var result = await _horseService.CreateHorseAsync(CurrentUserId, dto);
            if (!result.Success) return BadRequest(result);
            return CreatedAtAction(nameof(GetHorseById), new { id = result.Data!.HorseId }, result);
        }

        [HttpGet("my")]
        [Authorize(Roles = "Owner")]
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
        public async Task<IActionResult> GetHorseById(int id)
        {
            var result = await _horseService.GetHorseByIdAsync(CurrentUserId, id);
            if (!result.Success) return result.Message.Contains("NOT_FOUND") ? NotFound(result) : Forbid();
            return Ok(result);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> UpdateHorse(int id, [FromBody] UpdateHorseDto dto)
        {
            var result = await _horseService.UpdateHorseAsync(CurrentUserId, id, dto);
            if (!result.Success) return result.Message.Contains("NOT_FOUND") ? NotFound(result) : Forbid();
            return Ok(result);
        }
    }
}
