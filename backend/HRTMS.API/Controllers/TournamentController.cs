using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Tournament;
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
    [ApiController]
    [Route("api/tournament")]
    [Authorize(Roles = "Admin")]

    public class TournamentController : ControllerBase
    {
        private readonly ITournamentServices _tournamentService;

        public TournamentController(ITournamentServices tournamentServices)
        {
            _tournamentService = tournamentServices;
        }

        // Lay UserId tu JWT claim, khong nhan tu request body
        private int GetCurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);


        // POST/api/tournaments
        [HttpPost]
        public async Task<ActionResult<ApiResponse<TournamentResponseDto>>> Create(
            [FromBody] CreateTournamentDto dto)
        {
            try
            {
                var result = await _tournamentService.CreateTournamentAsync(dto, GetCurrentUserId());
                return Ok(ApiResponse<TournamentResponseDto>.Ok(result, "Tao giai dau thanh cong"));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<TournamentResponseDto>.Fail(ex.Message));
            }
        }

        // GET/api/tournaments
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<List<TournamentResponseDto>>>> GetAll()
        {
            var result = await _tournamentService.GetAllTournamentsAsync();
            return Ok(ApiResponse<List<TournamentResponseDto>>.Ok(result));
        }

        // GET/api/tournament/{id}
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<TournamentResponseDto>>> GetById(int id)
        {
            var result = await _tournamentService.GetTournamentByIdAsync(id);
            if (result == null)
                return NotFound(ApiResponse<TournamentResponseDto>.Fail($"Khong tim thay Tournament #{id}"));

            return Ok(ApiResponse<TournamentResponseDto>.Ok(result));
        }

        // PUT/api/tournaments/{id}
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<TournamentResponseDto>>> Update (int id, [FromBody] UpdateTournamentDto dto)
        {
            try
            {
                var result = await _tournamentService.UpdateTournamentAsync(id, dto);
                return Ok(ApiResponse<TournamentResponseDto>.Ok(result, "Cap nhat thanh cong")); 
            }
            catch(KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<TournamentResponseDto>.Fail($"ex.Message")); 
            }
            catch(InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<TournamentResponseDto>.Fail($"{ex.Message}"));
            }
        }

        // PATH/api/tournaments/{id}/status
        // Body: {"targetStatus": "Open Registration"}
        [HttpPatch("{id}/status")]
        public async Task<ActionResult<ApiResponse<TournamentResponseDto>>> ChangeStatus(int id, [FromBody] ChangeStatusDto dto)
        {
            try
            {
                var result = await _tournamentService.ChangeStatusAsync(id, dto.TargetStatus, GetCurrentUserId());
                return Ok(ApiResponse<TournamentResponseDto>.Ok(result, $"Chuyển trạng thái thành công: {dto.TargetStatus}"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<TournamentResponseDto>.Fail(ex.Message));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<TournamentResponseDto>.Fail(ex.Message));
            }
        }

        // DELETE/api/tournaments/{id}
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> Cancel(int id)
        {
            try
            {
                await _tournamentService.CancelTournamentAsync(id, GetCurrentUserId());
                return Ok(ApiResponse<object>.Ok(null!, "Huy giai dau thanh cong"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.Fail(ex.Message));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message));
            }
        }

        // PUT /api/tournaments/{id}/prize-distributions
        [HttpPut("{id}/prize-distributions")]
        public async Task<ActionResult<ApiResponse<List<PrizeDistributionResponseDto>>>> SetPrizeDistributions(
            int id, [FromBody] SetPrizeDistributionDto dto)
        {
            try
            {
                var result = await _tournamentService.SetPrizeDistributionsAsync(id, dto);
                return Ok(ApiResponse<List<PrizeDistributionResponseDto>>.Ok(result, "Cấu hình tỷ lệ thành công"));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<List<PrizeDistributionResponseDto>>.Fail(ex.Message));
            }
        }

        // POST /api/tournaments/{id}/rounds
        [HttpPost("{id}/rounds")]
        public async Task<ActionResult<ApiResponse<RoundResponseDto>>> CreateRound(
            int id, [FromBody] CreateRoundDto dto)
        {
            try
            {
                var result = await _tournamentService.CreateRoundAsync(id, dto);
                return Ok(ApiResponse<RoundResponseDto>.Ok(result, "Tạo vòng đua thành công"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<RoundResponseDto>.Fail(ex.Message));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<RoundResponseDto>.Fail(ex.Message));
            }
        }

        // POST /api/rounds/{id}/races  ← route khác! không phải /tournaments
        [HttpPost("/api/rounds/{id}/races")]
        public async Task<ActionResult<ApiResponse<RaceResponseDto>>> CreateRace(
            int id, [FromBody] CreateRaceDto dto)
        {
            try
            {
                var result = await _tournamentService.CreateRaceAsync(id, dto);
                return Ok(ApiResponse<RaceResponseDto>.Ok(result, "Tạo cuộc đua thành công"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<RaceResponseDto>.Fail(ex.Message));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<RaceResponseDto>.Fail(ex.Message));
            }
        }
    }

}
