namespace HRTMS.Core.DTOs.Jockey;

public class JockeyInvitationDto
{
    public int PairingId { get; set; }

    public InvitationHorseDto Horse { get; set; } = new();

    public InvitationOwnerDto Owner { get; set; } = new();

    public string? RequestMessage { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

public class InvitationHorseDto
{
    public int HorseId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Breed { get; set; } = string.Empty;
}

public class InvitationOwnerDto
{
    public int OwnerId { get; set; }

    public string FullName { get; set; } = string.Empty;
}