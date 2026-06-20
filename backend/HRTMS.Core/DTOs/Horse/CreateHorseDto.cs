using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.DTOs.Horse
{
    public class CreateHorseDto
    {
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = null!;

        [Required]
        [Range(1900, 9999)]
        public int BirthYear { get; set; }

        [Required]
        public string Gender { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string Color { get; set; } = null!;

        [MaxLength(255)]
        public string? Pedigree { get; set; }

        [Required]
        [Range(0.01, double.MaxValue)]
        public decimal Weight { get; set; }

        [Required]
        [MaxLength(255)]
        public string IdentifyingMarks { get; set; } = null!;

        [Required]
        [MaxLength(30)]
        public string Breed { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string VaccinationRecordRef { get; set; } = null!;

        [Required]
        public DateOnly DopingTestDate { get; set; }

        [Required]
        public string DopingTestResult { get; set; } = null!;

        [Required]
        public bool LegalConsentAccepted { get; set; }
    }
}
