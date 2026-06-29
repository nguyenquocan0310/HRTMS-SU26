namespace HRTMS.Core.DTOs.Pairing;

public class PairingResponseDto
{
    public int PairingId { get; set; }
    public int HorseId { get; set; }
    public int JockeyId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int TournamentId { get; set; }

}