namespace HRTMS.Core.DTOs.Medical;

public class RaceEntryHealthProfileDto
{
    public int RaceEntryId { get; set; }

    public int RaceId { get; set; }

    public int? PostPosition { get; set; }

    public int JockeyId { get; set; }

    public string JockeyName { get; set; } = null!;

    public string LicenseCertificate { get; set; } = null!;

    public int ExperienceYears { get; set; }

    public string? BloodType { get; set; }

    public string? HealthStatus { get; set; }

    public decimal SelfDeclaredWeight { get; set; }

    public decimal PreRaceWeightThresholdKg { get; set; }

    public decimal? PreRaceJockeyWeight { get; set; }

    public int? PreRaceWeightByDoctorId { get; set; }

    public string? PreRaceWeightByDoctorName { get; set; }

    public decimal? PreRaceWeightDifference { get; set; }

    public bool? IsPreRaceWeightWarning { get; set; }

    public decimal? PostRaceJockeyWeight { get; set; }

    public int? PostRaceWeightByDoctorId { get; set; }

    public string? PostRaceWeightByDoctorName { get; set; }

    public bool PostRaceWeightFlagged { get; set; }

    // --- Horse ---
    public int HorseId { get; set; }

    public string HorseName { get; set; } = null!;

    public string Breed { get; set; } = null!;

    public string Color { get; set; } = null!;

    public string Gender { get; set; } = null!;

    public int BirthYear { get; set; }

    public string IdentifyingMarks { get; set; } = null!;

    public string VaccinationRecordRef { get; set; } = null!;

    public DateOnly? DopingTestDate { get; set; }

    public string DopingTestResult { get; set; } = null!;

    public string? HorseIdentityCheckStatus { get; set; }

    public int? HorseIdentityCheckedByDoctorId { get; set; }

    public string? HorseIdentityCheckedByDoctorName { get; set; }

    public DateTime? HorseIdentityCheckedAt { get; set; }

    public string? ClinicalStatus { get; set; }

    public int? ClinicalCheckedByDoctorId { get; set; }

    public string? ClinicalCheckedByDoctorName { get; set; }

    public DateTime? ClinicalCheckedAt { get; set; }

    public string? UnfitReason { get; set; }
}