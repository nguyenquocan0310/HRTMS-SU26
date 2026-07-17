using HRTMS.Core.DTOs.Doctor;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HRTMS.Infrastructure.Services;

public class DoctorService : IDoctorService
{
    private readonly HRTMSDbContext _context;
    private readonly INotificationService _notificationService;

    public DoctorService(HRTMSDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<DoctorProfileDto?> GetProfileAsync(int doctorId)
    {
        var doctor = await _context.DoctorProfiles
            .Include(d => d.Doctor)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.DoctorId == doctorId);

        if (doctor == null) return null;

        return MapToDto(doctor);
    }

    public async Task<DoctorProfileDto?> UpdateProfileAsync(int doctorId, UpdateDoctorProfileDto dto)
    {
        var doctor = await _context.DoctorProfiles
            .Include(d => d.Doctor)
            .FirstOrDefaultAsync(d => d.DoctorId == doctorId);

        if (doctor == null) return null;

        var oldLicense = doctor.MedicalLicenseNumber;
        var oldStatus = doctor.Status;
        var normalizedLicense = dto.MedicalLicenseNumber.Trim();
        var licenseChanged = doctor.MedicalLicenseNumber != normalizedLicense;

        if (licenseChanged)
        {
            var licenseExists = await _context.DoctorProfiles
                .AnyAsync(d => d.DoctorId != doctorId && d.MedicalLicenseNumber == normalizedLicense);

            if (licenseExists)
                throw new InvalidOperationException("LICENSE_ALREADY_EXISTS");

            doctor.MedicalLicenseNumber = normalizedLicense;

            if (doctor.Status == "Active")
            {
                doctor.Status = "Pending";
                doctor.RejectionReason = null;
            }
        }

        doctor.UpdatedAt = DateTime.UtcNow;

        if (licenseChanged)
        {
            _context.AuditLogs.Add(new AuditLog
            {
                ActorId = doctorId,
                Action = "Update_Doctor_License",
                EntityName = "DoctorProfiles",
                EntityId = doctorId.ToString(),
                OldValue = JsonSerializer.Serialize(new
                {
                    MedicalLicenseNumber = oldLicense,
                    Status = oldStatus
                }),
                NewValue = JsonSerializer.Serialize(new
                {
                    doctor.MedicalLicenseNumber,
                    doctor.Status
                }),
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        if (licenseChanged && doctor.Status == "Pending")
        {
            await _notificationService.SendAsync(
                doctorId,
                "Hồ sơ Bác sĩ đang chờ duyệt lại",
                "Bạn vừa cập nhật Medical License Number. Hồ sơ của bạn sẽ tạm chuyển về " +
                "trạng thái chờ duyệt (Pending) cho tới khi Admin xác nhận lại chứng chỉ mới.",
                type: "Both",
                relatedEntityType: "DoctorProfiles",
                relatedEntityId: doctorId);
        }

        return MapToDto(doctor);
    }

    private static DoctorProfileDto MapToDto(DoctorProfile doctor) => new()
    {
        DoctorId = doctor.DoctorId,
        Username = doctor.Doctor.Username,
        FullName = doctor.Doctor.FullName,
        Email = doctor.Doctor.Email,
        MedicalLicenseNumber = doctor.MedicalLicenseNumber,
        Status = doctor.Status,
        PhoneNumber = doctor.Doctor.PhoneNumber,
        DateOfBirth = doctor.Doctor.DateOfBirth,
        CreatedAt = doctor.CreatedAt
    };
}