using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// TRN.1 Nhan data khi Admin tao moi giai dau
// Client POST len body nay. Server doc, validate roi map sang Entity 
// de luu DB. Chi co nhung field sau Admin duoc phep dien - khong bao gom
// status, createdAt, tournamentId
namespace HRTMS.Core.DTOs.Tournament
{
    public class CreateTournamentDto
    {
        [Required, MaxLength(200)] 
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        [Required]
        public DateTime StartDate { get; set; }
        [Required]
        public DateTime EndDate { get; set; }
        [Range(1, int.MaxValue, ErrorMessage ="MaxHorses must above 0")]
        public int MaxHorses { get; set; }

        //TRN.2 - sigle-select, 4 gia tri hop le 
        [Required]
        public string AllowBreed { get; set; } = string.Empty;
        [Required]
        public string TrackType { get; set; } = string.Empty;
        [Range(100, 10_000, ErrorMessage = "RaceDistance must be between 100 and 10,000")]
        public int RaceDistance { get; set; }
        [Required]
        public string RaceCatgory { get; set; } = string.Empty;
        [Range(0,50)]
        public int MinJockeyExperienceYears { get; set; }

        // TRN.1 - tong quy giai
        [Range(0, double.MaxValue)]
        public decimal PurseAmount { get; set;  }
        // TRN.3 - 0 = mien phi 
        [Range(0, double.MaxValue)]
        public decimal EntryFeeAmount { get; set; } = 0;
        // TRN.5 - nguong can nang
        public decimal PreRaceWeightThresholdKg { get; set; } = 2.0m; 
        public decimal PostRaceWeightThresholdKg { get; set; } = 1.0m;
    }
}
