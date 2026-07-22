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
            catch (KeyNotFoundException ex) when (ex.Message == "VENUE_NOT_FOUND")
            {
                return NotFound(VenueError(ex.Message));
            }
            catch (InvalidOperationException ex) when (IsVenueError(ex.Message))
            {
                return UnprocessableEntity(VenueError(ex.Message));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<TournamentResponseDto>.Fail(ex.Message));
            }
        }

        // Mã lỗi sân đua (patch 011) + deadline lệ phí (patch 012) dùng chung cho
        // Create/Update — cùng map sang 422.
        private static bool IsVenueError(string code) =>
            code is "VENUE_INACTIVE" or "MAX_HORSES_EXCEEDS_LANES"
                 or "TRACK_TYPE_VENUE_MISMATCH" or "VENUE_REQUIRED"
                 or "PAYMENT_DEADLINE_REQUIRED" or "PAYMENT_DEADLINE_OUT_OF_RANGE"
                 or "REFUND_DEADLINE_INVALID" or "DEADLINE_LOCKED"
                 or "ADVANCEMENT_CONFIGURATION_LOCKED";

        private static ApiResponse<TournamentResponseDto> VenueError(string code) => code switch
        {
            "PAYMENT_DEADLINE_REQUIRED" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Phải đặt hạn nộp lệ phí (giải miễn phí thì đây là hạn chốt đăng ký)."),
            "PAYMENT_DEADLINE_OUT_OF_RANGE" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Hạn nộp lệ phí phải ở tương lai và trước ngày khai mạc ít nhất 24 giờ."),
            "REFUND_DEADLINE_INVALID" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Hạn hoàn phí chỉ áp dụng cho giải có thu phí và phải nằm trong khoảng từ hạn nộp lệ phí đến ngày khai mạc."),
            "DEADLINE_LOCKED" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Đã qua hạn nộp lệ phí nên không thể thay đổi các mốc thời gian này nữa."),
            "VENUE_NOT_FOUND" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Không tìm thấy sân đua."),
            "VENUE_INACTIVE" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Sân đua này chưa hoạt động nên không thể dùng cho giải đấu."),
            "MAX_HORSES_EXCEEDS_LANES" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Số ngựa tối đa vượt quá số làn của sân đua đã chọn."),
            "TRACK_TYPE_VENUE_MISMATCH" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Loại mặt sân của giải phải trùng với loại mặt sân của sân đua đã chọn."),
            "VENUE_REQUIRED" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Giải đấu phải được gán sân đua trước khi cập nhật."),
            "ADVANCEMENT_CONFIGURATION_LOCKED" => ApiResponse<TournamentResponseDto>.Fail(code,
                "Không thể sửa số lượng đi tiếp vì đã có kết quả xét đi tiếp hoặc cuộc đua đã công bố chính thức."),
            _ => ApiResponse<TournamentResponseDto>.Fail(code, code)
        };

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
                var result = await _tournamentService.UpdateTournamentAsync(id, dto, GetCurrentUserId());
                return Ok(ApiResponse<TournamentResponseDto>.Ok(result, "Cap nhat thanh cong"));
            }
            catch (KeyNotFoundException ex) when (ex.Message == "VENUE_NOT_FOUND")
            {
                return NotFound(VenueError(ex.Message));
            }
            catch (InvalidOperationException ex) when (IsVenueError(ex.Message))
            {
                return UnprocessableEntity(VenueError(ex.Message));
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
                var result = await _tournamentService.SetPrizeDistributionsAsync(id, dto, GetCurrentUserId());
                return Ok(ApiResponse<List<PrizeDistributionResponseDto>>.Ok(result, "Cấu hình tỷ lệ thành công"));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<List<PrizeDistributionResponseDto>>.Fail(ex.Message));
            }
            catch (InvalidOperationException ex)
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
                var result = await _tournamentService.CreateRoundAsync(id, dto, GetCurrentUserId());
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
            catch (InvalidOperationException ex)
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
                var result = await _tournamentService.CreateRaceAsync(id, dto, GetCurrentUserId());
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
            catch (InvalidOperationException ex)
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

            // Chỉ public entries sau khi đã draw post position, Admin thấy luôn.
            bool isAdmin = User.IsInRole("Admin");
            if (!race.IsPostPositionDrawn && !isAdmin)
                return Ok(new
                {
                    success = true,
                    message = "Kết quả bốc thăm chưa được công bố.",
                    data = new
                    {
                        race.RaceId,
                        race.RoundId,
                        race.RaceNumber,
                        race.ScheduledTime,
                        race.Status,
                        race.IsPostPositionDrawn,
                        Entries = Array.Empty<object>()
                    }
                });

            var entries = await _context.RaceEntries
                .Include(e => e.Pairing).ThenInclude(p => p.Horse).ThenInclude(h => h.Owner).ThenInclude(o => o.Owner)
                .Include(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
                .Where(e => e.RaceId == raceId && e.Status != "Cancelled" && e.Status != "Disqualified")
                .OrderBy(e => e.PostPosition)
                .Select(e => new
                {
                    e.RaceEntryId,
                    e.PostPosition,
                    e.Status,
                    e.EntryFeeStatus,
                    HorseId = e.Pairing.Horse.HorseId,
                    HorseName = e.Pairing.Horse.Name,
                    JockeyId = e.Pairing.Jockey.JockeyId,
                    JockeyName = e.Pairing.Jockey.Jockey.FullName,
                    OwnerName = e.Pairing.Horse.Owner.Owner.FullName
                })
                .ToListAsync();

            return Ok(new
            {
                success = true,
                data = new
                {
                    race.RaceId,
                    race.RoundId,
                    race.RaceNumber,
                    race.ScheduledTime,
                    race.Status,
                    race.IsPostPositionDrawn,
                    Entries = entries
                }
            });
        }

        // Cập nhật cấu hình Race; đóng băng trường nhạy cảm sau bốc thăm / có Prediction.
        [HttpPut("/api/races/{raceId:int}")]
        public async Task<ActionResult<ApiResponse<RaceResponseDto>>> UpdateRace(
            int raceId, [FromBody] UpdateRaceDto dto)
        {
            try
            {
                var result = await _tournamentService.UpdateRaceAsync(raceId, dto, GetCurrentUserId());
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
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<RaceResponseDto>.Fail(ex.Message));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<RaceResponseDto>.Fail(ex.Message));
            }
        }
    }

}
