using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Result;
using HRTMS.Core.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace HRTMS.API.Controllers
{
    [ApiController]
    [Route("api/races")]
    [Authorize(Roles = "Admin")]
    public class ResultController : ControllerBase
    {
        private readonly IResultService _resultService;

        public ResultController(IResultService resultService)
        {
            _resultService = resultService;
        }

        // Lay UserId tu JWT claim, khong nhan tu request body — cùng pattern TournamentController
        private int GetCurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // GET /api/races/unofficial?tournamentId=123
        // REQ-F-RES.1 — Danh sách Race Unofficial để Admin chọn Declare (UI-S13)
        [HttpGet("unofficial")]
        public async Task<ActionResult<ApiResponse<List<UnofficialRaceListItemDto>>>> GetUnofficialRaces(
            [FromQuery] int? tournamentId)
        {
            var result = await _resultService.GetUnofficialRacesAsync(tournamentId);
            return Ok(ApiResponse<List<UnofficialRaceListItemDto>>.Ok(result));
        }

        // POST /api/races/{id}/declare-official
        // REQ-F-RES.2/RES.3/RES.4/RES.5 — Declare Official (ACID 6 bước)
        [HttpPost("{id}/declare-official")]
        public async Task<ActionResult<ApiResponse<DeclareOfficialResultDto>>> DeclareOfficial(
            int id, [FromBody] DeclareOfficialDto dto)
        {
            try
            {
                var result = await _resultService.DeclareOfficialAsync(id, dto, GetCurrentUserId());
                return Ok(ApiResponse<DeclareOfficialResultDto>.Ok(result, "Công bố kết quả chính thức thành công"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<DeclareOfficialResultDto>.Fail(ex.Message));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<DeclareOfficialResultDto>.Fail(ex.Message));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<DeclareOfficialResultDto>.Fail(ex.Message));
            }
        }
    }
}