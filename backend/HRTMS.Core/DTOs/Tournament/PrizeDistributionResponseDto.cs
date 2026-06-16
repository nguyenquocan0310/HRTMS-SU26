using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// Trả về tỷ lệ chia thưởng từng vị trí.
namespace HRTMS.Core.DTOs.Tournament
{
    public class PrizeDistributionResponseDto
    {
        public int Position { get; set; }
        public decimal Percentage { get; set; }
    }
}
