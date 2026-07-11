using System;
using System.Collections.Generic;

namespace HRTMS.Core.DTOs.LiveRace
{
	// ===========================================================================
	// UI-S07 — Live Race Simulation (client-side animation, không WebSocket/SSE).
	// BE chỉ cấp: trạng thái + actualStartTime, kết quả cuối (FinishPosition),
	// và violation ghi nhận trong lúc Live. Vị trí % của ngựa trong lúc chạy là
	// do FE tự random, BE không tính toán / không lưu.
	// ===========================================================================

	// GET /api/races/{raceId}/live-status
	public class LiveRaceStatusDto
	{
		public int RaceId { get; set; }
		public string Status { get; set; } = string.Empty; // Upcoming/Pre-Race/Live/Unofficial/Official/Cancelled
		public DateTime ScheduledTime { get; set; }
		public DateTime? ActualStartTime { get; set; }

		// Phase 1: thời lượng race cố định (giây), chưa scale theo RaceDistance.
		public int RaceDurationSeconds { get; set; } = 20;

		public List<LiveRaceEntryDto> Entries { get; set; } = new();
	}

	public class LiveRaceEntryDto
	{
		public int RaceEntryId { get; set; }
		public int? PostPosition { get; set; }
		public string Status { get; set; } = string.Empty;
		public bool IsWithdrawn { get; set; }
		public int HorseId { get; set; }
		public string HorseName { get; set; } = string.Empty;
		public int JockeyId { get; set; }
		public string JockeyName { get; set; } = string.Empty;

		// Chỉ có giá trị khi race đã Unofficial/Official — FE dùng để tween "về đích".
		public int? FinishPosition { get; set; }
		public decimal? FinishTime { get; set; }
	}

	// POST /api/referees/races/{raceId}/start
	public class StartRaceResultDto
	{
		public int RaceId { get; set; }
		public string Status { get; set; } = string.Empty;
		public DateTime ActualStartTime { get; set; }
	}

	// POST /api/referees/races/{raceId}/violations
	public class CreateViolationDto
	{
		public int RaceEntryId { get; set; }
		public string ViolationCode { get; set; } = string.Empty;
		public string Penalty { get; set; } = string.Empty; // Disqualified/PlaceBehind/Warning/Scratch
		public int? PlaceBehindEntryId { get; set; }
		public string Description { get; set; } = string.Empty;
	}

	// GET /api/races/{raceId}/violations (poll riêng, tách khỏi tick animation 100ms)
	public class ViolationDto
	{
		public int ViolationId { get; set; }
		public int RaceEntryId { get; set; }
		public string HorseName { get; set; } = string.Empty;
		public string ViolationCode { get; set; } = string.Empty;
		public string Penalty { get; set; } = string.Empty;
		public int? PlaceBehindEntryId { get; set; }
		public string Description { get; set; } = string.Empty;
		public DateTime LoggedAt { get; set; }
	}

	// POST /api/referees/races/{raceId}/finish — Referee chốt sơ bộ FinishPosition,
	// chuyển Live -> Unofficial (đúng REQ tại section 5: "Lấy kết quả cuối sau khi
	// Referee chốt sơ bộ").
	public class SubmitFinishResultsDto
	{
		public string? Notes { get; set; }
		public List<FinishEntryDto> Results { get; set; } = new();
	}

	public class FinishEntryDto
	{
		public int RaceEntryId { get; set; }
		public int FinishPosition { get; set; }
		public decimal? FinishTime { get; set; }
	}

	public class SubmitFinishResultsResultDto
	{
		public int RaceId { get; set; }
		public string Status { get; set; } = string.Empty; // "Unofficial"
		public int RaceReportId { get; set; }
	}
}
