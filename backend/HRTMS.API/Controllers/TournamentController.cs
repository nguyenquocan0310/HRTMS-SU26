using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Tournament;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.API.Controllers
{
    [Tags("tournament")]
    [ApiController]
    [Route("api/tournament")]
    [Authorize(Roles = "Admin")]

    public class TournamentController : ControllerBase
    {
        private readonly ITournamentServices _tournamentService;
        private readonly HRTMSDbContext _context;

        public TournamentController(ITournamentServices tournamentServices, HRTMSDbContext context)
        {
            _tournamentService = tournamentServices;
            _context = context;
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
        [HttpGet("{id}")]
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
        public async Task<ActionResult<ApiResponse<TournamentResponseDto>>> Update(int id, [FromBody] UpdateTournamentDto dto)
        {
            try
            {
                var result = await _tournamentService.UpdateTournamentAsync(id, dto);
                return Ok(ApiResponse<TournamentResponseDto>.Ok(result, "Cap nhat thanh cong"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<TournamentResponseDto>.Fail(ex.Message));
            }
            catch (InvalidOperationException ex)
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

        [HttpGet("/api/races/{raceId:int}/entries")]
        [AllowAnonymous]
        public async Task<IActionResult> GetRaceEntries(int raceId)
        {
            var race = await _context.Races
                .Include(r => r.Round).ThenInclude(r => r.Tournament)
                .FirstOrDefaultAsync(r => r.RaceId == raceId);

            if (race == null)
                return NotFound(new { success = false, message = "RACE_NOT_FOUND" });

            // Chỉ public sau khi đã draw post position, Admin thấy luôn
            bool isAdmin = User.IsInRole("Admin");
            if (!race.IsPostPositionDrawn && !isAdmin)
                return Ok(new { success = true, message = "Kết quả bốc thăm chưa được công bố.", data = Array.Empty<object>() });

            var entries = await _context.RaceEntries
                .Include(e => e.Pairing).ThenInclude(p => p.Horse)
                .Include(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
                .Where(e => e.RaceId == raceId && e.Status != "Cancelled" && e.Status != "Disqualified")
                .OrderBy(e => e.PostPosition)
                .Select(e => new
                {
                    e.RaceEntryId,
                    e.PostPosition,
                    e.Status,
                    e.EntryFeeStatus,
                    Horse = new { e.Pairing.Horse.HorseId, e.Pairing.Horse.Name, e.Pairing.Horse.Breed },
                    Jockey = new { e.Pairing.Jockey.JockeyId, e.Pairing.Jockey.Jockey.FullName }
                })
                .ToListAsync();

            return Ok(new { success = true, data = entries });
        }

        // SCH.9/EC-48 — cap nhat cau hinh Race; dong bang truong nhay cam sau boc tham / co Prediction.
        [HttpPut("/api/races/{raceId:int}")]
        public async Task<ActionResult<ApiResponse<RaceResponseDto>>> UpdateRace(
            int raceId, [FromBody] UpdateRaceDto dto)
        {
            try
            {
                var result = await _tournamentService.UpdateRaceAsync(raceId, dto);
                return Ok(ApiResponse<RaceResponseDto>.Ok(result, "Cập nhật cuộc đua thành công"));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<RaceResponseDto>.Fail(ex.Message));
            }
            catch (InvalidOperationException ex) when (ex.Message == "RACE_CONFIG_FROZEN")
            {
                return Conflict(ApiResponse<RaceResponseDto>.Fail(
                    "Cấu hình cuộc đua đã bị khóa sau khi bốc thăm hoặc đã có dự đoán (EC-48)."));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<RaceResponseDto>.Fail(ex.Message));
            }
        }
    }

}