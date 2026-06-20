using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.DTOs.Horse
{
    public class CreateRaceEntryDto
    {
        [Required]
        public int PairingId { get; set; }

        [Required]
        public int RaceId { get; set; }
    }
}
