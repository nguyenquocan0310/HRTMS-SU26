namespace HRTMS.Core.DTOs.Pairing;

public class PairingActionResponseDto
{
    public int PairingId { get; set; }

    public string Status { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;
}