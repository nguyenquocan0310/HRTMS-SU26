using HRTMS.Core.DTOs.Referee;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HRTMS.Infrastructure.Services;

public class RefereeService : IRefereeService
{
    private readonly HRTMSDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ITokenBlacklistService _tokenBlacklistService;

    public RefereeService(
        HRTMSDbContext context,
        INotificationService notificationService,
        ITokenBlacklistService tokenBlacklistService)
    {
        _context = context;
        _notificationService = notificationService;
        _tokenBlacklistService = tokenBlacklistService;
    }

    public async Task<RefereeProfileDto?> GetProfileAsync(int refereeId)
    {
        var referee = await _context.RefereeProfiles
            .Include(r => r.Referee)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.RefereeId == refereeId);

        if (referee == null) return null;

        return MapToDto(referee);
    }

    public async Task<RefereeProfileDto?> UpdateProfileAsync(int refereeId, UpdateRefereeProfileDto dto)
    {
        var referee = await _context.RefereeProfiles
            .Include(r => r.Referee)
            .FirstOrDefaultAsync(r => r.RefereeId == refereeId);

        if (referee == null) return null;

        var oldCertification = referee.CertificationLevel;
        var oldStatus = referee.Status;
        var normalizedCertification = dto.CertificationLevel.Trim();
        var certificationChanged = referee.CertificationLevel != normalizedCertification;

        if (certificationChanged)
        {
            referee.CertificationLevel = normalizedCertification;
            referee.Status = "Pending";
            referee.RejectionReason = null;

            if (referee.Referee != null)
            {
                referee.Referee.Status = "Pending";
                referee.Referee.UpdatedAt = DateTime.UtcNow;
            }
        }

        referee.UpdatedAt = DateTime.UtcNow;

        if (certificationChanged)
        {
            _context.AuditLogs.Add(new AuditLog
            {
                ActorId = refereeId,
                Action = "Update_Referee_Certification",
                EntityName = "RefereeProfiles",
                EntityId = refereeId.ToString(),
                OldValue = JsonSerializer.Serialize(new
                {
                    CertificationLevel = oldCertification,
                    Status = oldStatus
                }),
                NewValue = JsonSerializer.Serialize(new
                {
                    referee.CertificationLevel,
                    referee.Status
                }),
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        if (certificationChanged)
        {
            await _tokenBlacklistService.BlacklistUserAsync(refereeId);

            await _notificationService.SendAsync(
                refereeId,
                "Hồ sơ Trọng tài đang chờ duyệt lại",
                "Bạn vừa cập nhật Certification Level. Hồ sơ của bạn sẽ tạm chuyển về " +
                "trạng thái chờ duyệt (Pending) cho tới khi Admin xác nhận lại chứng chỉ mới. " +
                "Vui lòng đăng nhập lại sau khi Admin phê duyệt.",
                type: "Both",
                relatedEntityType: "RefereeProfiles",
                relatedEntityId: refereeId);
        }

        return MapToDto(referee);
    }

    private static RefereeProfileDto MapToDto(RefereeProfile referee) => new()
    {
        RefereeId = referee.RefereeId,
        Username = referee.Referee.Username,
        FullName = referee.Referee.FullName,
        Email = referee.Referee.Email,
        CertificationLevel = referee.CertificationLevel,
        Status = referee.Status,
        PhoneNumber = referee.Referee.PhoneNumber,
        DateOfBirth = referee.Referee.DateOfBirth,
        CreatedAt = referee.CreatedAt
    };
}