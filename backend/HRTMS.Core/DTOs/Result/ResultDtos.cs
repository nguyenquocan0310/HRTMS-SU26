using System;
using System.Collections.Generic;

namespace HRTMS.Core.DTOs.Result
{
    // ===========================================================================
    // Danh sách Race đang Unofficial (đã có biên bản) chờ Declare
    // ===========================================================================
    public class UnofficialRaceListItemDto
    {
        public int RaceId { get; set; }
        public int TournamentId { get; set; }
        public string TournamentName { get; set; } = string.Empty;
        public string RoundName { get; set; } = string.Empty;
        public int RaceNumber { get; set; }
        public DateTime ScheduledTime { get; set; }

        public bool HasRaceReport { get; set; }
        public bool IsRaceReportLocked { get; set; }

        // Các điều kiện chặn Declare Official
        public bool PrizeDistributionsConfigured { get; set; }
        public bool RankingIntegrityValid { get; set; }
        public bool PostRaceWeighInComplete { get; set; }

        public bool CanDeclareOfficial =>
            HasRaceReport && !IsRaceReportLocked &&
            PrizeDistributionsConfigured &&
            RankingIntegrityValid && PostRaceWeighInComplete;
    }

    // ===========================================================================
    // Request: Admin bấm "Công bố kết quả chính thức" (UI-S13 modal xác nhận)
    // ===========================================================================
    public class DeclareOfficialDto
    {
        public bool ConfirmedByAdmin { get; set; }
    }

    // ===========================================================================
    // Response: kết quả sau khi Declare Official thành công
    // ===========================================================================
    public class DeclareOfficialResultDto
    {
        public int RaceId { get; set; }
        public string RaceStatus { get; set; } = string.Empty; // "Official"
        public DateTime OfficialAt { get; set; }

        public int PredictionsSettledCount { get; set; }
        public int PredictionsRefundedCount { get; set; }
        public int PursePayoutsCreatedCount { get; set; }

        // Phần dư khi số ngựa về đích hợp lệ < số vị trí thưởng.
        // Không lưu DB (chưa có cột tương ứng) — chỉ trả về để UI-S14 hiển thị,
        // Admin xử lý thủ công (ghi nhận Remainder) ngoài hệ thống.
        public decimal? RemainderAmount { get; set; }
    }
}
