using System;
using System.Collections.Generic;

namespace HRTMS.Core.Entities;

public partial class RaceEntry
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public int PairingId { get; set; }

    public int? PostPosition { get; set; }

    public string Status { get; set; } = null!;

    public decimal? PreRaceJockeyWeight { get; set; }

    public int? PreRaceWeightByDoctorId { get; set; }

    public string? HorseIdentityCheckStatus { get; set; }

    public int? HorseIdentityCheckedByDoctorId { get; set; }

    public DateTime? HorseIdentityCheckedAt { get; set; }

    public string? ClinicalStatus { get; set; }

    public int? ClinicalCheckedByDoctorId { get; set; }

    public DateTime? ClinicalCheckedAt { get; set; }

    public decimal? PostRaceJockeyWeight { get; set; }

    public int? PostRaceWeightByDoctorId { get; set; }

    // Khám lâm sàng SAU trận (cả ngựa + nài, patch 015) — bắt buộc trước khi
    // Admin được Declare Official, đối xứng với ClinicalStatus (khám trước trận).
    public string? PostRaceClinicalStatus { get; set; }

    public string? PostRaceUnfitReason { get; set; }

    public int? PostRaceClinicalCheckedByDoctorId { get; set; }

    public DateTime? PostRaceClinicalCheckedAt { get; set; }

    public int? FinishPosition { get; set; }

    public decimal? FinishTime { get; set; }

    public int? PointsAwarded { get; set; }

    public decimal? EarningsAwarded { get; set; }

    // Progression (patch 002): tính sau khi race Official; NULL = chưa xét.
    public string? AdvancementStatus { get; set; }

    public int? AdvancementRank { get; set; }

    public string? AdvancementReason { get; set; }

    public string EntryFeeStatus { get; set; } = null!;

    public int? EntryFeeConfirmedBy { get; set; }

    public DateTime? EntryFeeConfirmedAt { get; set; }

    public bool IsWithdrawn { get; set; }

    public string? WithdrawalReason { get; set; }

    public string? UnfitReason { get; set; }

    public bool PostRaceWeightFlagged { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    // Optimistic concurrency token (SQL Server ROWVERSION, patch 005) — chặn
    // last-write-wins khi nhiều actor cùng ghi 1 entry. NULL trên provider không
    // hỗ trợ rowversion (SQLite trong test).
    public byte[]? RowVersion { get; set; }

    public virtual DoctorProfile? ClinicalCheckedByDoctor { get; set; }

    public virtual User? EntryFeeConfirmedByNavigation { get; set; }

    public virtual DoctorProfile? HorseIdentityCheckedByDoctor { get; set; }

    public virtual Pairing Pairing { get; set; } = null!;

    public virtual DoctorProfile? PostRaceWeightByDoctor { get; set; }

    public virtual DoctorProfile? PostRaceClinicalCheckedByDoctor { get; set; }

    public virtual DoctorProfile? PreRaceWeightByDoctor { get; set; }

    public virtual ICollection<Prediction> Predictions { get; set; } = new List<Prediction>();

    public virtual ICollection<PursePayout> PursePayouts { get; set; } = new List<PursePayout>();

    public virtual Race Race { get; set; } = null!;

    public virtual ICollection<Violation> ViolationPlaceBehindEntries { get; set; } = new List<Violation>();

    public virtual ICollection<Violation> ViolationRaceEntries { get; set; } = new List<Violation>();
}
