using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Pairing;

public class DeclinePairingDto
{
    [MaxLength(255)]
    public string? ResponseReason { get; set; }
}