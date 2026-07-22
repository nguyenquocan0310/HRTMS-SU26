using HRTMS.Core.DTOs.Venue;

namespace HRTMS.Core.Interfaces.Services
{
    // Module B — quản lý sân đua (patch 011).
    public interface IVenueService
    {
        // includeInactive chỉ dành cho Admin; endpoint public luôn gọi với false.
        Task<List<VenueResponseDto>> GetAllAsync(bool includeInactive = false);

        Task<VenueResponseDto?> GetByIdAsync(int venueId);

        Task<VenueResponseDto> CreateAsync(CreateVenueDto dto, int adminUserId);

        Task<VenueResponseDto> UpdateAsync(int venueId, UpdateVenueDto dto, int adminUserId);
    }
}
