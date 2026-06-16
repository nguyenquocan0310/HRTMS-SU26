using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// Nhan 5 ty le chia tuong Top1 - Top5
// Tach rieng thanh DTO doc lap vi day la mot operation rieng - endpoint reing,
// khong phai luc tao giai ma co the config sau. Chua 5 list PrizeItemDto
// moi item la {Postion, Percentage}
namespace HRTMS.Core.DTOs.Tournament
{
    public class SetPrizeDistributionDto
    {
        [Required, MinLength(5), MaxLength(5)]
        public List<PrizeItemDto> Distributions { get; set; } = new(); 
    }

    public class PrizeItemDto
    {
        [Range(1, 5)]
        public int Position { get; set;  }
        [Range(0.01, 100)]
        public decimal Percentage { get; set; }
    }
}
