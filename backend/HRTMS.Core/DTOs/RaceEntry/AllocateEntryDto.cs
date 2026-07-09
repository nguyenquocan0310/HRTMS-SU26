using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.RaceEntry;

// Admin phân bổ một Pairing đã được Accepted vào một Race.
// RaceId lấy từ route, PairingId lấy từ body.
public class AllocateEntryDto
{
    [Range(1, int.MaxValue)]
    public int PairingId { get; set; }
}
