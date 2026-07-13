using System;
using HRTMS.Core.Entities;

namespace HRTMS.Infrastructure.Services
{
    /// <summary>
    /// Nguồn tính toán DUY NHẤT cho hạn chót cửa sổ khiếu nại (Protest window).
    /// Dùng chung giữa ProtestService (chặn Submit sau khi hết hạn) và
    /// ResultService (chặn Declare Official trước khi hết hạn) để đảm bảo
    /// 2 điều kiện luôn đối xứng — không lệch công thức giữa 2 nơi.
    /// </summary>
    public static class ProtestWindowPolicy
    {
        /// <summary>
        /// Thời điểm cửa sổ khiếu nại đóng lại. Null nếu race chưa có RaceReport
        /// (chưa có mốc SubmittedAt để tính).
        /// </summary>
        public static DateTime? GetDeadline(Race race)
        {
            if (race.RaceReport == null) return null;
            return race.RaceReport.SubmittedAt.AddMinutes(race.ProtestDeadlineMinutes);
        }

        /// <summary>True nếu cửa sổ khiếu nại đã đóng (hết hạn nộp Protest mới).</summary>
        public static bool IsClosed(Race race, DateTime now)
        {
            var deadline = GetDeadline(race);
            return deadline.HasValue && now > deadline.Value;
        }
    }
}