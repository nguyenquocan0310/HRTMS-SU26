using System;

namespace HRTMS.Core.DTOs.Horse
{
    /// <summary>
    /// Kết quả enrollment một con ngựa vào một giải (screening + AdminApproval theo giải).
    /// </summary>
    public class HorseEnrollmentResponseDto
    {
        public int EnrollmentId { get; set; }
        public int HorseId { get; set; }
        public string HorseName { get; set; } = null!;
        public int TournamentId { get; set; }
        public string? TournamentName { get; set; }
        public string Status { get; set; } = null!;
        public string ScreeningStatus { get; set; } = null!;
        public string? ScreeningReason { get; set; }
        public string AdminApprovalStatus { get; set; } = null!;
        public string? RejectionReason { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
