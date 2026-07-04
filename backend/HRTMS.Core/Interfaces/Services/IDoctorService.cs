using HRTMS.Core.DTOs.Doctor;

namespace HRTMS.Core.Interfaces.Services;

public interface IDoctorService
{
    Task<DoctorProfileDto?> GetProfileAsync(int doctorId);

    Task<DoctorProfileDto?> UpdateProfileAsync(int doctorId, UpdateDoctorProfileDto dto);
}