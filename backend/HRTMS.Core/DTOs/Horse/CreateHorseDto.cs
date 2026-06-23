using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Horse
{
    public class CreateHorseDto
    {
        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Phải chọn giải đấu để đăng ký ngựa vào.")]
        public int TournamentId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = null!;

        [Required]
        [Range(1900, 9999)]
        public int BirthYear { get; set; }

        [Required]
        [AllowedValues("Male", "Female", "Gelding")]
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
        [AllowedValues("Thoroughbred", "Arabian", "Quarter Horse", "Mixed")]
        public string Breed { get; set; } = null!;

        [Required]
        [MaxLength(100)]
        public string VaccinationRecordRef { get; set; } = null!;

        [Required]
        public DateOnly DopingTestDate { get; set; }

        [Required]
        [AllowedValues("Clean", "Pending", "Failed")]
        public string DopingTestResult { get; set; } = null!;

        [Required]
        public bool LegalConsentAccepted { get; set; }
    }
}
