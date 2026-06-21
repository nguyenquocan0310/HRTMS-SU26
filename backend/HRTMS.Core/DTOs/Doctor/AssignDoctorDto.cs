using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Doctor;

public class AssignDoctorDto
{
    [Required(ErrorMessage = "DoctorId is required.")]
    public int DoctorId { get; set; }
}