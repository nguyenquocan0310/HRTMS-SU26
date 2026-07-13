using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Protest;

public class SubmitProtestDto
{
    [Range(1, int.MaxValue)]
    public int RaceId { get; set; }

    [Range(1, int.MaxValue)]
    public int AccusedRaceEntryId { get; set; }

    public int? ViolationId { get; set; }

    [Required]
    [StringLength(500, MinimumLength = 20)]
    public string Description { get; set; } = string.Empty;
}

public class RuleProtestDto
{
    [Required]
    [RegularExpression("^(Approved|Rejected)$")]
    public string Decision { get; set; } = string.Empty;

    [RegularExpression("^(Disqualified|PlaceBehind|Warning|Scratch)$")]
    public string? Penalty { get; set; }

    public int? PlaceBehindEntryId { get; set; }

    [Required]
    [StringLength(500, MinimumLength = 10)]
    public string Notes { get; set; } = string.Empty;
}

public class ProtestDto
{
    public int ProtestId { get; set; }
    public int RaceId { get; set; }
    public int SubmittedByUserId { get; set; }
    public int AccusedRaceEntryId { get; set; }
    public int? ViolationId { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? RefereeDecision { get; set; }
    public string? PenaltyApplied { get; set; }
    public DateTime SubmittedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public class ProtestRulingResultDto
{
    public ProtestDto Protest { get; set; } = new();
    public IReadOnlyList<RankedRaceEntryDto> Rankings { get; set; } = Array.Empty<RankedRaceEntryDto>();
}

public class RankedRaceEntryDto
{
    public int RaceEntryId { get; set; }
    public int? FinishPosition { get; set; }
    public string Status { get; set; } = string.Empty;
}
