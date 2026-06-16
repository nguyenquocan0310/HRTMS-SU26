using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// TRN.9 - Nhan data khi Admin update giai dau
// Tat ca field deu nullable(string?, int?) vi Admin co the chi sua 1 
// field, cac field con lai khong gui len thi giu nguyen trong DB 
namespace HRTMS.Core.DTOs.Tournament
{
    public class UpdateTournamentDto
    {
        [MaxLength(200)]
        public string? Name { get; set; }
        public string? Description { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? MaxHorses { get; set; }
        public string? AllowedBreed { get; set; }
        public string? TrackType { get; set; }
        public int? RaceDistance { get; set; }
        public string? RaceCategory { get; set; }
        public int? MinJockeyExperienceYears { get; set; }
        public decimal? PurseAmount { get; set; }
        public decimal? EntryFeeAmount { get; set; }
        public decimal? PreRaceWeightThresholdKg { get; set; }
        public decimal? PostRaceWeightDiffThresholdKg { get; set; }
    }
}
