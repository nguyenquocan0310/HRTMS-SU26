using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Horse;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services
{
    public interface IHorseService
    {
        // Owner — Kho ngựa (profile)
        Task<ApiResponse<HorseResponseDto>> CreateHorseAsync(int ownerId, CreateHorseDto dto);
        Task<ApiResponse<List<HorseResponseDto>>> GetMyHorsesAsync(int ownerId, string? approvalStatus, int page, int pageSize);
        Task<ApiResponse<HorseResponseDto>> GetHorseByIdAsync(int ownerId, int horseId);
        Task<ApiResponse<HorseResponseDto>> UpdateHorseAsync(int ownerId, int horseId, UpdateHorseDto dto);

        // Owner — Enrollment (đẩy ngựa vào giải)
        Task<ApiResponse<HorseEnrollmentResponseDto>> EnrollHorseAsync(int ownerId, int horseId, EnrollHorseDto dto);
        Task<ApiResponse<List<HorseEnrollmentResponseDto>>> GetMyEnrollmentsAsync(int ownerId, int? horseId, int? tournamentId, int page, int pageSize);

        // Admin — duyệt enrollment theo từng giải
        Task<ApiResponse<List<HorseEnrollmentResponseDto>>> GetPendingEnrollmentsAsync(int page, int pageSize);
        Task<ApiResponse<HorseResponseDto>> GetHorseByIdAdminAsync(int horseId);
        Task<ApiResponse<string>> ApproveEnrollmentAsync(int adminId, int enrollmentId);
        Task<ApiResponse<string>> RejectEnrollmentAsync(int adminId, int enrollmentId, AdminRejectHorseDto dto);
        // RaceEntry (RaceEntry chi do Admin tao qua Module E SCH.1; Owner chi xem)
        Task<ApiResponse<List<RaceEntryResponseDto>>> GetMyRaceEntriesAsync(int ownerId, string? status, string? feeStatus, int page, int pageSize);

        // Admin - RaceEntry
        Task<ApiResponse<List<RaceEntryResponseDto>>> GetPendingFeeEntriesAsync(int page, int pageSize);
        Task<ApiResponse<string>> ConfirmEntryFeeAsync(int adminId, int raceEntryId);
        Task<ApiResponse<string>> ApproveRaceEntryAsync(int adminId, int raceEntryId);
        Task<ApiResponse<string>> RejectRaceEntryAsync(int adminId, int raceEntryId, string reason);

    }
}
