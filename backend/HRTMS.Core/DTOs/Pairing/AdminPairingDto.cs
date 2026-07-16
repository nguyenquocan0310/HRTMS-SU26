namespace HRTMS.Core.DTOs.Pairing;

// Module E — Admin allocation picker: liet ke pairing de chon phan bo vao Race (SCH.1),
// thay cho viec go tay Pairing ID tren FE.
public class AdminPairingDto
{
    public int PairingId { get; set; }

    public int TournamentId { get; set; }
    public string TournamentName { get; set; } = null!;

    public int HorseId { get; set; }
    public string HorseName { get; set; } = null!;
    public string HorseBreed { get; set; } = null!;

    public int JockeyId { get; set; }
    public string JockeyName { get; set; } = null!;

    public int OwnerId { get; set; }
    public string OwnerName { get; set; } = null!;

    public string Status { get; set; } = null!;

    // NULL cho round dau; Qualified/AlsoEligible khi allocate round sau.
    public string? AdvancementStatus { get; set; }

    // true neu pairing da co RaceEntry dang active (Pending/Confirmed) gan voi no.
    public bool IsAllocated { get; set; }

    public DateTime CreatedAt { get; set; }
}
