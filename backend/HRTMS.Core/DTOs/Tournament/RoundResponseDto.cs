using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.DTOs.Tournament
{
    // Trả về thông tin một Round, kèm nested list Races bên trong.
    public class RoundResponseDto
    {
        public int RoundId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int SequenceOrder { get; set; }
        public DateTime ScheduledDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public List<RaceResponseDto> Races { get; set; } = new(); 
    }
}
