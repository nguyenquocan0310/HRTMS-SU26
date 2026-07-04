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

    public RefereeService(HRTMSDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
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

            if (referee.Status == "Active")
            {
                referee.Status = "Pending";
                referee.RejectionReason = null;
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

        if (certificationChanged && referee.Status == "Pending")
        {
            await _notificationService.SendAsync(
                refereeId,
                "Hồ sơ Trọng tài đang chờ duyệt lại",
                "Bạn vừa cập nhật Certification Level. Hồ sơ của bạn sẽ tạm chuyển về " +
                "trạng thái chờ duyệt (Pending) cho tới khi Admin xác nhận lại chứng chỉ mới.",
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
        CreatedAt = referee.CreatedAt
    };
}