using HRTMS.Core.DTOs.Medical;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class MedicalCheckService : IMedicalCheckService
{
    private readonly HRTMSDbContext _context;
    private readonly IEmergencyDisqualificationService _emergencyDisqualificationService;

    public MedicalCheckService(
        HRTMSDbContext context,
        IEmergencyDisqualificationService emergencyDisqualificationService)
    {
        _context = context;
        _emergencyDisqualificationService = emergencyDisqualificationService;
    }
    // Kiem tra doctor hop le
    private async Task<DoctorProfile> ValidateDoctorAsync(int doctorId)
    {
        var doctor = await _context.DoctorProfiles
            .Include(d => d.Doctor)
            .FirstOrDefaultAsync(d => d.DoctorId == doctorId);

        if (doctor == null)
            throw new KeyNotFoundException("DOCTOR_NOT_FOUND");

        if (doctor.Doctor.Role != "Doctor")
            throw new InvalidOperationException("USER_NOT_DOCTOR");

        if (doctor.Status != "Active")
            throw new InvalidOperationException("DOCTOR_NOT_ACTIVE");

        return doctor;
    }

    public async Task<PreRaceWeightResultDto> RecordPreRaceWeightAsync(
        int doctorId,
        int raceEntryId,
        RecordPreRaceWeightDto dto)
    {
        // Kiem tra Doctor co ton tai va dang Active hay khong
        var doctor = await ValidateDoctorAsync(doctorId);

        // Lay RaceEntry kem Race, Tournament, Horse, Jockey
        var raceEntry = await _context.RaceEntries
            .Include(e => e.Race)
                .ThenInclude(r => r.Round)
                    .ThenInclude(round => round.Tournament)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Horse)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Jockey)
                    .ThenInclude(j => j.Jockey)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);

        if (raceEntry == null)
        {
            throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");
        }

        // Chi RaceEntry hop le moi duoc ghi can
        if (raceEntry.Status == "Cancelled" ||
            raceEntry.Status == "Disqualified" ||
            raceEntry.IsWithdrawn)
        {
            throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");
        }

        // Doctor phai duoc phan cong vao Race nay moi duoc ghi can
        var doctorAssigned = await _context.DoctorAssignments
            .AnyAsync(a =>
                a.RaceId == raceEntry.RaceId &&
                a.DoctorId == doctorId);

        if (!doctorAssigned)
        {
            throw new InvalidOperationException("DOCTOR_NOT_ASSIGNED_TO_RACE");
        }

        // Khong cho ghi can khi Race da Live/Unofficial/Official
        if (raceEntry.Race.Status != "Upcoming")
        {
            throw new InvalidOperationException("RACE_NOT_UPCOMING");
        }

        var selfDeclaredWeight = raceEntry.Pairing.Jockey.SelfDeclaredWeight;
        var thresholdKg = raceEntry.Race.Round.Tournament.PreRaceWeightThresholdKg;

        var weightDifference = Math.Abs(
            dto.PreRaceJockeyWeight - selfDeclaredWeight);

        var isWeightWarning = weightDifference > thresholdKg;

        raceEntry.PreRaceJockeyWeight = dto.PreRaceJockeyWeight;
        raceEntry.PreRaceWeightByDoctorId = doctorId;
        raceEntry.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new PreRaceWeightResultDto
        {
            RaceEntryId = raceEntry.RaceEntryId,
            RaceId = raceEntry.RaceId,
            DoctorId = doctorId,
            DoctorName = doctor.Doctor.FullName,
            HorseName = raceEntry.Pairing.Horse.Name,
            JockeyName = raceEntry.Pairing.Jockey.Jockey.FullName,
            SelfDeclaredWeight = selfDeclaredWeight,
            PreRaceJockeyWeight = dto.PreRaceJockeyWeight,
            WeightDifference = weightDifference,
            ThresholdKg = thresholdKg,
            IsWeightWarning = isWeightWarning,
            Message = isWeightWarning
                ? "Pre-race weight exceeds the configured threshold."
                : "Pre-race weight recorded successfully."
        };
    }
    public async Task<HorseIdentityResultDto> RecordHorseIdentityAsync(
     int doctorId,
     int raceEntryId,
     RecordHorseIdentityDto dto)
    {
        // Kiem tra Doctor co ton tai va dang Active hay khong
        var doctor = await ValidateDoctorAsync(doctorId);

        // Lay RaceEntry kem Race va Horse
        var raceEntry = await _context.RaceEntries
            .Include(e => e.Race)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);

        if (raceEntry == null)
        {
            throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");
        }

        // Doctor phai duoc phan cong vao Race nay moi duoc xac minh
        var doctorAssigned = await _context.DoctorAssignments
            .AnyAsync(a =>
                a.RaceId == raceEntry.RaceId &&
                a.DoctorId == doctorId);

        if (!doctorAssigned)
        {
            throw new InvalidOperationException("DOCTOR_NOT_ASSIGNED_TO_RACE");
        }

        // Chi RaceEntry hop le moi duoc xac minh
        if (raceEntry.Status == "Cancelled" ||
            raceEntry.Status == "Disqualified" ||
            raceEntry.IsWithdrawn)
        {
            throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");
        }

        // Chi cho xac minh truoc khi Race bat dau
        if (raceEntry.Race.Status != "Upcoming")
        {
            throw new InvalidOperationException("RACE_NOT_UPCOMING");
        }

        var now = DateTime.UtcNow;

        raceEntry.HorseIdentityCheckStatus = dto.HorseIdentityCheckStatus;
        raceEntry.HorseIdentityCheckedByDoctorId = doctorId;
        raceEntry.HorseIdentityCheckedAt = now;
        raceEntry.UpdatedAt = now;

        var isMismatch = dto.HorseIdentityCheckStatus == "Mismatch";

        await _context.SaveChangesAsync();

        if (isMismatch)
        {
            await _emergencyDisqualificationService.DisqualifyAsync(
                doctorId,
                raceEntry.RaceEntryId,
                "Horse identity mismatch at paddock.",
                "MED.4_HORSE_IDENTITY_CHECK");
        }

        return new HorseIdentityResultDto
        {
            RaceEntryId = raceEntry.RaceEntryId,
            RaceId = raceEntry.RaceId,
            DoctorId = doctorId,
            DoctorName = doctor.Doctor.FullName,
            HorseName = raceEntry.Pairing.Horse.Name,
            HorseIdentityCheckStatus = dto.HorseIdentityCheckStatus,
            IsEmergencyDisqualified = isMismatch,
            RaceEntryStatus = raceEntry.Status,
            Message = isMismatch
                ? "Horse identity mismatch. Race entry has been disqualified."
                : "Horse identity matched successfully."
        };
    }

    public async Task<ClinicalCheckResultDto> RecordClinicalCheckAsync(
    int doctorId,
    int raceEntryId,
    RecordClinicalCheckDto dto)
    {
        // Kiem tra Doctor co ton tai va dang Active hay khong
       var doctor = await ValidateDoctorAsync(doctorId);

        // Lay RaceEntry kem Race va Horse
        var raceEntry = await _context.RaceEntries
            .Include(e => e.Race)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);

        if (raceEntry == null)
        {
            throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");
        }

        // Doctor phai duoc phan cong vao Race nay moi duoc kiem tra
        var doctorAssigned = await _context.DoctorAssignments
            .AnyAsync(a =>
                a.RaceId == raceEntry.RaceId &&
                a.DoctorId == doctorId);

        if (!doctorAssigned)
        {
            throw new InvalidOperationException("DOCTOR_NOT_ASSIGNED_TO_RACE");
        }

        // Chi RaceEntry hop le moi duoc kiem tra
        if (raceEntry.Status == "Cancelled" ||
            raceEntry.Status == "Disqualified" ||
            raceEntry.IsWithdrawn)
        {
            throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");
        }

        // Chi cho kiem tra truoc khi Race bat dau
        if (raceEntry.Race.Status != "Upcoming")
        {
            throw new InvalidOperationException("RACE_NOT_UPCOMING");
        }

        // Neu Unfit thi bat buoc co ly do toi thieu 20 ky tu
        if (dto.ClinicalStatus == "Unfit" &&
            string.IsNullOrWhiteSpace(dto.UnfitReason))
        {
            throw new InvalidOperationException("UNFIT_REASON_REQUIRED");
        }

        if (dto.ClinicalStatus == "Unfit" &&
            dto.UnfitReason!.Trim().Length < 20)
        {
            throw new InvalidOperationException("UNFIT_REASON_TOO_SHORT");
        }

        var now = DateTime.UtcNow;

        raceEntry.ClinicalStatus = dto.ClinicalStatus;
        raceEntry.ClinicalCheckedByDoctorId = doctorId;
        raceEntry.ClinicalCheckedAt = now;
        raceEntry.UnfitReason = dto.ClinicalStatus == "Unfit"
            ? dto.UnfitReason!.Trim()
            : null;
        raceEntry.UpdatedAt = now;

        var isUnfit = dto.ClinicalStatus == "Unfit";

        // MED.5: Unfit se kich hoat Emergency DQ
        // Ban hien tai xu ly DQ toi thieu: cap nhat RaceEntry thanh Disqualified
        // Phan ACID refund + notification + audit se lam o MED.7
        await _context.SaveChangesAsync();

        if (isUnfit)
        {
            await _emergencyDisqualificationService.DisqualifyAsync(
                doctorId,
                raceEntry.RaceEntryId,
                raceEntry.UnfitReason ?? "Horse is unfit for racing.",
                "MED.5_CLINICAL_CHECK");
        }

        await _context.SaveChangesAsync();

        return new ClinicalCheckResultDto
        {
            RaceEntryId = raceEntry.RaceEntryId,
            RaceId = raceEntry.RaceId,
            DoctorId = doctorId,
            DoctorName = doctor.Doctor.FullName,
            HorseName = raceEntry.Pairing.Horse.Name,
            ClinicalStatus = dto.ClinicalStatus,
            UnfitReason = raceEntry.UnfitReason,
            IsEmergencyDisqualified = isUnfit,
            RaceEntryStatus = raceEntry.Status,
            Message = isUnfit
                ? "Horse is unfit. Race entry has been disqualified."
                : "Horse is fit for racing."
        };
    }
    public async Task<List<MedicalCheckListDto>> GetRaceEntriesAsync(
    int doctorId,
    int raceId)
{
    // Kiem tra doctor
    await ValidateDoctorAsync(doctorId);

    // Kiem tra doctor co duoc phan cong race khong
    var assigned = await _context.DoctorAssignments.AnyAsync(x =>
        x.DoctorId == doctorId &&
        x.RaceId == raceId);

    if (!assigned)
    {
        throw new InvalidOperationException(
            "DOCTOR_NOT_ASSIGNED_TO_RACE");
    }

    var entries = await _context.RaceEntries
        .Where(x => x.RaceId == raceId)
        .Include(x => x.Pairing)
            .ThenInclude(p => p.Horse)
        .Include(x => x.Pairing)
            .ThenInclude(p => p.Jockey)
                .ThenInclude(j => j.Jockey)
        .Select(x => new MedicalCheckListDto
        {
            RaceEntryId = x.RaceEntryId,

            PairingId = x.PairingId,

            HorseName = x.Pairing.Horse.Name,

            JockeyName = x.Pairing.Jockey.Jockey.FullName,

            SelfDeclaredWeight =
                x.Pairing.Jockey.SelfDeclaredWeight,

            PreRaceWeight =
                x.PreRaceJockeyWeight,

            HorseIdentityStatus =
                x.HorseIdentityCheckStatus ?? "Pending",

            ClinicalStatus =
                x.ClinicalStatus ?? "Pending"
        })
        .ToListAsync();

    return entries;
}
    public async Task<RaceEntryHealthProfileDto> GetRaceEntryHealthProfileAsync(
        int doctorId,
        int raceEntryId)
    {
        // Kiem tra Doctor co ton tai va dang Active hay khong
        await ValidateDoctorAsync(doctorId);

        var raceEntry = await _context.RaceEntries
            .Include(e => e.Race)
                .ThenInclude(r => r.Round)
                    .ThenInclude(round => round.Tournament)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Jockey)
                    .ThenInclude(j => j.Jockey)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Horse)
            .Include(e => e.PreRaceWeightByDoctor)
                .ThenInclude(d => d!.Doctor)
            .Include(e => e.PostRaceWeightByDoctor)
                .ThenInclude(d => d!.Doctor)
            .Include(e => e.HorseIdentityCheckedByDoctor)
                .ThenInclude(d => d!.Doctor)
            .Include(e => e.ClinicalCheckedByDoctor)
                .ThenInclude(d => d!.Doctor)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);

        if (raceEntry == null)
        {
            throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");
        }

        // Doctor phai duoc phan cong vao Race nay moi duoc xem ho so
        var doctorAssigned = await _context.DoctorAssignments
            .AnyAsync(a =>
                a.RaceId == raceEntry.RaceId &&
                a.DoctorId == doctorId);

        if (!doctorAssigned)
        {
            throw new InvalidOperationException("DOCTOR_NOT_ASSIGNED_TO_RACE");
        }

        var jockeyProfile = raceEntry.Pairing.Jockey;
        var horse = raceEntry.Pairing.Horse;
        var thresholdKg = raceEntry.Race.Round.Tournament.PreRaceWeightThresholdKg;

        decimal? preRaceWeightDifference = raceEntry.PreRaceJockeyWeight.HasValue
            ? Math.Abs(raceEntry.PreRaceJockeyWeight.Value - jockeyProfile.SelfDeclaredWeight)
            : null;

        return new RaceEntryHealthProfileDto
        {
            RaceEntryId = raceEntry.RaceEntryId,
            RaceId = raceEntry.RaceId,

            // Jockey
            JockeyId = jockeyProfile.JockeyId,
            JockeyName = jockeyProfile.Jockey.FullName,
            LicenseCertificate = jockeyProfile.LicenseCertificate,
            ExperienceYears = jockeyProfile.ExperienceYears,
            BloodType = jockeyProfile.BloodType,
            HealthStatus = jockeyProfile.HealthStatus,
            SelfDeclaredWeight = jockeyProfile.SelfDeclaredWeight,
            PreRaceWeightThresholdKg = thresholdKg,
            PreRaceJockeyWeight = raceEntry.PreRaceJockeyWeight,
            PreRaceWeightByDoctorId = raceEntry.PreRaceWeightByDoctorId,
            PreRaceWeightByDoctorName = raceEntry.PreRaceWeightByDoctor?.Doctor.FullName,
            PreRaceWeightDifference = preRaceWeightDifference,
            IsPreRaceWeightWarning = preRaceWeightDifference.HasValue
                ? preRaceWeightDifference.Value > thresholdKg
                : null,
            PostRaceJockeyWeight = raceEntry.PostRaceJockeyWeight,
            PostRaceWeightByDoctorId = raceEntry.PostRaceWeightByDoctorId,
            PostRaceWeightByDoctorName = raceEntry.PostRaceWeightByDoctor?.Doctor.FullName,
            PostRaceWeightFlagged = raceEntry.PostRaceWeightFlagged,

            // Horse
            HorseId = horse.HorseId,
            HorseName = horse.Name,
            Breed = horse.Breed,
            Color = horse.Color,
            Gender = horse.Gender,
            BirthYear = horse.BirthYear,
            IdentifyingMarks = horse.IdentifyingMarks,
            VaccinationRecordRef = horse.VaccinationRecordRef,
            DopingTestDate = horse.DopingTestDate,
            DopingTestResult = horse.DopingTestResult,
            HorseIdentityCheckStatus = raceEntry.HorseIdentityCheckStatus,
            HorseIdentityCheckedByDoctorId = raceEntry.HorseIdentityCheckedByDoctorId,
            HorseIdentityCheckedByDoctorName = raceEntry.HorseIdentityCheckedByDoctor?.Doctor.FullName,
            HorseIdentityCheckedAt = raceEntry.HorseIdentityCheckedAt,
            ClinicalStatus = raceEntry.ClinicalStatus,
            ClinicalCheckedByDoctorId = raceEntry.ClinicalCheckedByDoctorId,
            ClinicalCheckedByDoctorName = raceEntry.ClinicalCheckedByDoctor?.Doctor.FullName,
            ClinicalCheckedAt = raceEntry.ClinicalCheckedAt,
            UnfitReason = raceEntry.UnfitReason
        };
    }
}
