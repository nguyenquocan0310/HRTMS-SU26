using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Pairing
{
    public class CreatePairingDto
    {
        [Required]
        public int TournamentId { get; set; }

        [Required]
        public int HorseId { get; set; }

        [Required]
        public int JockeyId { get; set; }

        [MaxLength(255)]
        public string? RequestMessage { get; set; }
    }
}