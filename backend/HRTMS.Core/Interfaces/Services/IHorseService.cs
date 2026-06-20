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
        // Owner
        Task<ApiResponse<HorseResponseDto>> CreateHorseAsync(int ownerId, CreateHorseDto dto);
        Task<ApiResponse<List<HorseResponseDto>>> GetMyHorsesAsync(int ownerId, string? approvalStatus, int page, int pageSize);
        Task<ApiResponse<HorseResponseDto>> GetHorseByIdAsync(int ownerId, int horseId);
        Task<ApiResponse<HorseResponseDto>> UpdateHorseAsync(int ownerId, int horseId, UpdateHorseDto dto);

        // Admin
        Task<ApiResponse<List<HorseResponseDto>>> GetPendingHorsesAsync(int page, int pageSize);
        Task<ApiResponse<HorseResponseDto>> GetHorseByIdAdminAsync(int horseId);
        Task<ApiResponse<string>> ApproveHorseAsync(int adminId, int horseId);
        Task<ApiResponse<string>> RejectHorseAsync(int adminId, int horseId, AdminRejectHorseDto dto);
        // RaceEntry
        Task<ApiResponse<RaceEntryResponseDto>> CreateRaceEntryAsync(int ownerId, CreateRaceEntryDto dto);
        Task<ApiResponse<List<RaceEntryResponseDto>>> GetMyRaceEntriesAsync(int ownerId, string? status, string? feeStatus, int page, int pageSize);

        // Admin - RaceEntry
        Task<ApiResponse<List<RaceEntryResponseDto>>> GetPendingFeeEntriesAsync(int page, int pageSize);
        Task<ApiResponse<string>> ConfirmEntryFeeAsync(int adminId, int raceEntryId);
        Task<ApiResponse<string>> ApproveRaceEntryAsync(int adminId, int raceEntryId);
        Task<ApiResponse<string>> RejectRaceEntryAsync(int adminId, int raceEntryId, string reason);

    }
}
