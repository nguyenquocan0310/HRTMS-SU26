using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.DTOs.Tournament
{
    public class ChangeStatusDto
    {
        [Required]
        public string TargetStatus { get; set; } = string.Empty; 
    }
}
