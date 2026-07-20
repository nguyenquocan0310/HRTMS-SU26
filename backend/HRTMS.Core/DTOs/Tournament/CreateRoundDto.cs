using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
// Nhan data khi tao mot vong dua (vong loai, ban ket, chung ket) ben trong giai 
// Tach khoi Tournament vi Round duoc tao sau, qua endpoint rieng
// POST/tournament/{id}/round
namespace HRTMS.Core.DTOs.Tournament
{
    public class CreateRoundDto
    {
        [Required, MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        [Range(1, 100)]
        public int SequenceOrder { get; set; }
        [Required(ErrorMessage = "Vui lòng nhập ngày của vòng.")]
        public DateTime? ScheduledDate { get; set; }
    }
}
