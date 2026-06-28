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
    [Tags("results")]
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

        private int GetCurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        [HttpGet("unofficial")]
        public async Task<ActionResult<ApiResponse<List<UnofficialRaceListItemDto>>>> GetUnofficialRaces(
            [FromQuery] int? tournamentId)
        {
            var result = await _resultService.GetUnofficialRacesAsync(tournamentId);
            return Ok(ApiResponse<List<UnofficialRaceListItemDto>>.Ok(result));
        }

        [HttpPost("{id}/declare-official")]
        public async Task<ActionResult<ApiResponse<DeclareOfficialResultDto>>> DeclareOfficial(
            int id, [FromBody] DeclareOfficialDto dto)
        {
            try
            {
                var result = await _resultService.DeclareOfficialAsync(id, dto, GetCurrentUserId());
                return Ok(ApiResponse<DeclareOfficialResultDto>.Ok(result, "Công bố kết quả chính thức thành công"));
            }
            catch (KeyNotFoundException ex) { return NotFound(ApiResponse<DeclareOfficialResultDto>.Fail(ex.Message)); }
            catch (InvalidOperationException ex) { return BadRequest(ApiResponse<DeclareOfficialResultDto>.Fail(ex.Message)); }
            catch (ArgumentException ex) { return BadRequest(ApiResponse<DeclareOfficialResultDto>.Fail(ex.Message)); }
        }
    }
}