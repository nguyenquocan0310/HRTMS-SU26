namespace HRTMS.Core.DTOs.Pairing;

public class OwnerPairingDto
{
    public int PairingId { get; set; }

    public OwnerPairingHorseDto Horse { get; set; } = new();

    public OwnerPairingJockeyDto Jockey { get; set; } = new();

    public string? RequestMessage { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public int TournamentId { get; set; }
}

public class OwnerPairingHorseDto
{
    public int HorseId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Breed { get; set; } = string.Empty;
}

public class OwnerPairingJockeyDto
{
    public int JockeyId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string LicenseCertificate { get; set; } = string.Empty;

    public int ExperienceYears { get; set; }
}