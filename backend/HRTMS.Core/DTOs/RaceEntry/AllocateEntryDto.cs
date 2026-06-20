using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.RaceEntry;

// SCH.1 — Admin phan bo mot Pairing da duoc Accepted vao mot Race.
// RaceId lay tu route, PairingId lay tu body.
public class AllocateEntryDto
{
    [Range(1, int.MaxValue)]
    public int PairingId { get; set; }
}
