using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class Tournament
{
    public int TournamentId { get; set; }

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime StartDate { get; set; }

    public DateTime EndDate { get; set; }

    public int MaxHorses { get; set; }

    public string AllowedBreed { get; set; } = null!;

    public string TrackType { get; set; } = null!;

    public int RaceDistance { get; set; }

    public string RaceCategory { get; set; } = null!;

    public int MinJockeyExperienceYears { get; set; }

    public decimal PurseAmount { get; set; }

    public decimal EntryFeeAmount { get; set; }

    public decimal PreRaceWeightThresholdKg { get; set; }

    public decimal PostRaceWeightDiffThresholdKg { get; set; }

    public string Status { get; set; } = null!;

    // Sân đua (patch 011). NULL ở DB cho giải cũ tạo trước patch; TournamentService
    // bắt buộc giá trị này khi tạo/cập nhật giải mới.
    public int? VenueId { get; set; }

    // Hạn nộp lệ phí (patch 012). NULL = giải không áp hạn; FeeDeadlineJob bỏ qua.
    public DateTime? PaymentDeadline { get; set; }

    // Hạn hoàn phí khi rút lui (patch 012). NULL = không hoàn.
    public DateTime? RefundDeadline { get; set; }

    // Progression (patch 002): rule chọn ngựa đi tiếp + Top N per race.
    public string AdvancementRule { get; set; } = "TopPerRace";

    public int AdvancementCount { get; set; } = 5;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int? CreatedBy { get; set; }

    public virtual User? CreatedByNavigation { get; set; }

    public virtual Venue? Venue { get; set; }

    public virtual ICollection<HorseTournamentEntry> HorseEntries { get; set; } = new List<HorseTournamentEntry>();

    public virtual ICollection<Pairing> Pairings { get; set; } = new List<Pairing>();

    public virtual ICollection<PrizeDistribution> PrizeDistributions { get; set; } = new List<PrizeDistribution>();

    public virtual ICollection<Round> Rounds { get; set; } = new List<Round>();

    public virtual ICollection<TournamentParticipant> TournamentParticipants { get; set; } = new List<TournamentParticipant>();
}
