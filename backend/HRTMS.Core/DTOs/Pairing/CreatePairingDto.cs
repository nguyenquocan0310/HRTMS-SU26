using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Pairing;

public class CreatePairingDto
{
    [Range(1, int.MaxValue)]
    public int HorseId { get; set; }

    [Range(1, int.MaxValue)]
    public int JockeyId { get; set; }

    [MaxLength(255)]
    public string? RequestMessage { get; set; }
}