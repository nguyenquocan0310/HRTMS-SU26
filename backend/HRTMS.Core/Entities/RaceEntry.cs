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

    public decimal? PostRaceJockeyWeight { get; set; }

    public int? PostRaceWeightByDoctorId { get; set; }

    public int? FinishPosition { get; set; }

    public decimal? FinishTime { get; set; }

    public int? PointsAwarded { get; set; }

    public decimal? EarningsAwarded { get; set; }

    public string EntryFeeStatus { get; set; } = null!;

    public int? EntryFeeConfirmedBy { get; set; }

    public DateTime? EntryFeeConfirmedAt { get; set; }

    public bool IsWithdrawn { get; set; }

    public string? WithdrawalReason { get; set; }

    public string? UnfitReason { get; set; }

    public bool PostRaceWeightFlagged { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual User? EntryFeeConfirmedByNavigation { get; set; }

    public virtual Pairing Pairing { get; set; } = null!;

    public virtual DoctorProfile? PostRaceWeightByDoctor { get; set; }

    public virtual DoctorProfile? PreRaceWeightByDoctor { get; set; }

    public virtual ICollection<Prediction> Predictions { get; set; } = new List<Prediction>();

    public virtual ICollection<Protest> Protests { get; set; } = new List<Protest>();

    public virtual ICollection<PursePayout> PursePayouts { get; set; } = new List<PursePayout>();

    public virtual Race Race { get; set; } = null!;

    public virtual ICollection<Violation> ViolationPlaceBehindEntries { get; set; } = new List<Violation>();

    public virtual ICollection<Violation> ViolationRaceEntries { get; set; } = new List<Violation>();
    // Ket qua xac minh danh tinh ngua tai Paddock
    // Gia tri: Matched hoac Mismatch
    public string? HorseIdentityStatus { get; set; }

    // Doctor thuc hien xac minh danh tinh ngua
    public int? HorseIdentityCheckedByDoctorId { get; set; }

    // Thoi gian xac minh danh tinh ngua
    public DateTime? HorseIdentityCheckedAt { get; set; }

    // Navigation den Doctor da xac minh danh tinh ngua
    public virtual DoctorProfile? HorseIdentityCheckedByDoctor { get; set; }
    // Ket qua kiem tra suc khoe ngua
    // Gia tri: Fit hoac Unfit
    public string? ClinicalStatus { get; set; }

    // Doctor thuc hien kiem tra suc khoe
    public int? ClinicalCheckedByDoctorId { get; set; }

    // Thoi gian kiem tra suc khoe
    public DateTime? ClinicalCheckedAt { get; set; }

    // Navigation den Doctor da kiem tra suc khoe
    public virtual DoctorProfile? ClinicalCheckedByDoctor { get; set; }
}
