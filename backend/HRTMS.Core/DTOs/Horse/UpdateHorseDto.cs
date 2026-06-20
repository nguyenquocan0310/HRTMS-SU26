using System.ComponentModel.DataAnnotations;
using HRTMS.Core.Common;

namespace HRTMS.Core.DTOs.Horse
{
    public class UpdateHorseDto
    {
        [MaxLength(100)]
        public string? Name { get; set; }

        [Range(1900, 9999)]
        public int? BirthYear { get; set; }

        [AllowedValues("Male", "Female", "Gelding")]
        public string? Gender { get; set; }

        [MaxLength(50)]
        public string? Color { get; set; }

        [MaxLength(255)]
        public string? Pedigree { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal? Weight { get; set; }

        [MaxLength(255)]
        public string? IdentifyingMarks { get; set; }

        [AllowedValues("Thoroughbred", "Arabian", "Quarter Horse", "Mixed")]
        public string? Breed { get; set; }

        [MaxLength(100)]
        public string? VaccinationRecordRef { get; set; }

        public DateOnly? DopingTestDate { get; set; }

        [AllowedValues("Clean", "Pending", "Failed")]
        public string? DopingTestResult { get; set; }
    }
}
