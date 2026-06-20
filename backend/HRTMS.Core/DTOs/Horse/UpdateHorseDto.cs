using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.DTOs.Horse
{
    public class UpdateHorseDto
    {
        [MaxLength(100)]
        public string? Name { get; set; }

        [Range(1900, 9999)]
        public int? BirthYear { get; set; }

        public string? Gender { get; set; }

        [MaxLength(50)]
        public string? Color { get; set; }

        [MaxLength(255)]
        public string? Pedigree { get; set; }

        [Range(0.01, double.MaxValue)]
        public decimal? Weight { get; set; }

        [MaxLength(255)]
        public string? IdentifyingMarks { get; set; }

        [MaxLength(30)]
        public string? Breed { get; set; }

        [MaxLength(100)]
        public string? VaccinationRecordRef { get; set; }

        public DateOnly? DopingTestDate { get; set; }

        public string? DopingTestResult { get; set; }
    }
}
