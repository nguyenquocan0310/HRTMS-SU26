namespace HRTMS.Core.DTOs.Doctor;

public class DoctorAssignmentDto
{
    public int RaceId { get; set; }

    public int DoctorId { get; set; }

    public string DoctorName { get; set; } = null!;

    public string DoctorEmail { get; set; } = null!;

    public string MedicalLicenseNumber { get; set; } = null!;

    public DateTime AssignedAt { get; set; }

    public DateTime? CertifiedAt { get; set; }
}