using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Doctor;

public class UpdateDoctorProfileDto
{
    [Required, MaxLength(50)]
    public string MedicalLicenseNumber { get; set; } = string.Empty;
}

public class DoctorProfileDto
{
    public int DoctorId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string MedicalLicenseNumber { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}