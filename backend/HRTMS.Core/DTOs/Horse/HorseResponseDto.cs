using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.DTOs.Horse
{
    public class HorseResponseDto
    {
        public int HorseId { get; set; }
        public int OwnerId { get; set; }
        public string Name { get; set; } = null!;
        public int BirthYear { get; set; }
        public int Age => DateTime.UtcNow.Year - BirthYear;
        public string Gender { get; set; } = null!;
        public string Color { get; set; } = null!;
        public string? Pedigree { get; set; }
        public decimal Weight { get; set; }
        public string IdentifyingMarks { get; set; } = null!;
        public string Breed { get; set; } = null!;
        public string VaccinationRecordRef { get; set; } = null!;
        public DateOnly DopingTestDate { get; set; }
        public string DopingTestResult { get; set; } = null!;
        public bool LegalConsentAccepted { get; set; }
        public string AdminApprovalStatus { get; set; } = null!;
        public string? RejectionReason { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
