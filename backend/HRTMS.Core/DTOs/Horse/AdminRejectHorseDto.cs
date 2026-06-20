using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.DTOs.Horse
{
    public class AdminRejectHorseDto
    {
        [Required]
        [MinLength(10)]
        [MaxLength(500)]
        public string Reason { get; set; } = null!;
    }
}
