using HRTMS.Core.DTOs.Venue;

namespace HRTMS.Core.Interfaces.Services
{
    // Module B — quản lý sân đua (patch 012).
    public interface IVenueService
    {
        // includeInactive chỉ dành cho Admin; endpoint public luôn gọi với false.
        Task<List<VenueResponseDto>> GetAllAsync(bool includeInactive = false);

        // Danh sách vận hành cho Admin. Có filter để UI không phải tải toàn bộ rồi
        // lọc sai/sót sân inactive ở client.
        Task<List<VenueResponseDto>> GetAdminListAsync(
            string? search,
            string? city,
            string? trackType,
            bool? isActive);

        Task<VenueResponseDto?> GetByIdAsync(int venueId);

        Task<VenueResponseDto> CreateAsync(CreateVenueDto dto, int adminUserId);

        Task<VenueResponseDto> UpdateAsync(int venueId, UpdateVenueDto dto, int adminUserId);
    }
}
