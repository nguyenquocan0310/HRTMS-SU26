using HRTMS.Core.DTOs.Venue;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services
{
    // Module B — quản lý sân đua (patch 011).
    // Theo convention HRTMS: service ném exception với "error code" là message
    // để Controller map sang HTTP status.
    public class VenueService : IVenueService
    {
        private static readonly string[] ValidTrackTypes = ["Dirt", "Turf", "Synthetic"];

        private readonly HRTMSDbContext _context;
        private readonly IAuditLogService _auditLog;

        public VenueService(HRTMSDbContext context, IAuditLogService auditLog)
        {
            _context = context;
            _auditLog = auditLog;
        }

        public async Task<List<VenueResponseDto>> GetAllAsync(bool includeInactive = false)
        {
            var query = _context.Venues.AsNoTracking();

            // Endpoint public chỉ thấy sân đang hoạt động — sân inactive là dữ liệu
            // vận hành nội bộ (đang sửa chữa/chưa khai trương).
            if (!includeInactive)
                query = query.Where(v => v.IsActive);

            var venues = await query.OrderBy(v => v.Name).ToListAsync();
            return venues.Select(MapToDto).ToList();
        }

        public async Task<VenueResponseDto?> GetByIdAsync(int venueId)
        {
            var venue = await _context.Venues
                .AsNoTracking()
                .FirstOrDefaultAsync(v => v.VenueId == venueId);

            return venue == null ? null : MapToDto(venue);
        }

        public async Task<VenueResponseDto> CreateAsync(CreateVenueDto dto, int adminUserId)
        {
            ValidateTrackType(dto.TrackType);

            var name = dto.Name.Trim();
            // UQ_Venues_Name cũng chặn ở DB; check trước để trả error code ổn định
            // thay vì DbUpdateException.
            if (await _context.Venues.AnyAsync(v => v.Name == name))
                throw new InvalidOperationException("VENUE_NAME_DUPLICATE");

            var now = DateTime.UtcNow;
            var venue = new Venue
            {
                Name = name,
                Address = dto.Address?.Trim(),
                City = dto.City?.Trim(),
                TrackType = dto.TrackType,
                TrackLengthMeters = dto.TrackLengthMeters,
                LaneCount = dto.LaneCount,
                IsActive = dto.IsActive,
                CreatedAt = now,
                UpdatedAt = now
            };

            _context.Venues.Add(venue);
            await _context.SaveChangesAsync();

            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Tạo sân đua",
                entityName: "Venue",
                entityId: venue.VenueId.ToString(),
                newValue: $"{venue.Name};Lanes={venue.LaneCount};TrackType={venue.TrackType}");

            return MapToDto(venue);
        }

        public async Task<VenueResponseDto> UpdateAsync(int venueId, UpdateVenueDto dto, int adminUserId)
        {
            var venue = await _context.Venues.FirstOrDefaultAsync(v => v.VenueId == venueId)
                ?? throw new KeyNotFoundException("VENUE_NOT_FOUND");

            var oldValue = $"{venue.Name};Lanes={venue.LaneCount};Active={venue.IsActive}";

            if (dto.Name != null)
            {
                var name = dto.Name.Trim();
                if (await _context.Venues.AnyAsync(v => v.Name == name && v.VenueId != venueId))
                    throw new InvalidOperationException("VENUE_NAME_DUPLICATE");
                venue.Name = name;
            }

            if (dto.TrackType != null)
            {
                ValidateTrackType(dto.TrackType);
                venue.TrackType = dto.TrackType;
            }

            if (dto.Address != null) venue.Address = dto.Address.Trim();
            if (dto.City != null) venue.City = dto.City.Trim();
            if (dto.TrackLengthMeters.HasValue) venue.TrackLengthMeters = dto.TrackLengthMeters.Value;
            if (dto.IsActive.HasValue) venue.IsActive = dto.IsActive.Value;

            if (dto.LaneCount.HasValue && dto.LaneCount.Value != venue.LaneCount)
            {
                // Giảm số làn xuống dưới MaxHorses của một giải đang dùng sân sẽ tạo
                // ra giải không bao giờ xếp đủ ngựa. Chặn tại đây thay vì để lỗi nổ
                // lúc auto-allocate.
                var blockingMaxHorses = await _context.Tournaments
                    .Where(t => t.VenueId == venueId &&
                                t.Status != "Completed" && t.Status != "Cancelled" &&
                                t.MaxHorses > dto.LaneCount.Value)
                    .Select(t => (int?)t.MaxHorses)
                    .FirstOrDefaultAsync();
                if (blockingMaxHorses.HasValue)
                    throw new InvalidOperationException("LANE_COUNT_BELOW_TOURNAMENT_MAX_HORSES");

                venue.LaneCount = dto.LaneCount.Value;
            }

            venue.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Cập nhật sân đua",
                entityName: "Venue",
                entityId: venue.VenueId.ToString(),
                oldValue: oldValue,
                newValue: $"{venue.Name};Lanes={venue.LaneCount};Active={venue.IsActive}");

            return MapToDto(venue);
        }

        private static void ValidateTrackType(string trackType)
        {
            if (!ValidTrackTypes.Contains(trackType))
                throw new ArgumentException($"Loại mặt sân không hợp lệ: {trackType}. Chỉ chấp nhận: {string.Join(", ", ValidTrackTypes)}.");
        }

        private static VenueResponseDto MapToDto(Venue v) => new()
        {
            VenueId = v.VenueId,
            Name = v.Name,
            Address = v.Address,
            City = v.City,
            TrackType = v.TrackType,
            TrackLengthMeters = v.TrackLengthMeters,
            LaneCount = v.LaneCount,
            IsActive = v.IsActive,
            CreatedAt = v.CreatedAt,
            UpdatedAt = v.UpdatedAt
        };
    }
}
