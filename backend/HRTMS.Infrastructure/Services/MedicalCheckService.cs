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
    private readonly IAuditLogService _auditLog;

    public MedicalCheckService(
        HRTMSDbContext context,
        IEmergencyDisqualificationService emergencyDisqualificationService,
        IAuditLogService auditLog)
    {
        _context = context;
        _emergencyDisqualificationService = emergencyDisqualificationService;
        _auditLog = auditLog;
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
        if (raceEntry.Race.Status == "Pre-Race")
        {
            // Starting list da duoc confirm chinh thuc -> khong cho sua du lieu tien dua nua.
            throw new InvalidOperationException("STARTING_LIST_ALREADY_CONFIRMED");
        }

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

        await _auditLog.LogAsync(
            actorId: doctorId,
            action: "Record_Pre_Race_Weight",
            entityName: "RaceEntry",
            entityId: raceEntry.RaceEntryId.ToString(),
            newValue: $"PreRaceJockeyWeight={dto.PreRaceJockeyWeight}, SelfDeclared={selfDeclaredWeight}, " +
                      $"Difference={weightDifference}, ThresholdKg={thresholdKg}, IsWeightWarning={isWeightWarning}");

        // Lech qua threshold khong duoc phep pass am tham - phai kich hoat
        // Emergency DQ nhu HorseIdentity/Clinical, chu khong chi tra ve warning.
        if (isWeightWarning)
        {
            await _emergencyDisqualificationService.DisqualifyAsync(
                doctorId,
                raceEntry.RaceEntryId,
                $"Pre-race weight difference ({weightDifference}kg) exceeds threshold ({thresholdKg}kg).",
                "MED.2_PRE_RACE_WEIGHT_CHECK");
        }

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
            IsEmergencyDisqualified = isWeightWarning,
            RaceEntryStatus = raceEntry.Status,
            Message = isWeightWarning
                ? "Pre-race weight exceeds the configured threshold. Race entry has been disqualified."
                : "Pre-race weight recorded successfully."
        };
    }
    public async Task<PostRaceWeightResultDto> RecordPostRaceWeightAsync(
        int doctorId,
        int raceEntryId,
        RecordPostRaceWeightDto dto)
    {
        var doctor = await ValidateDoctorAsync(doctorId);
        var raceEntry = await _context.RaceEntries
            .Include(e => e.Race)
                .ThenInclude(r => r.Round)
                    .ThenInclude(round => round.Tournament)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId)
            ?? throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");

        if (raceEntry.Status == "Cancelled" || raceEntry.Status == "Disqualified" || raceEntry.IsWithdrawn)
            throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");

        var doctorAssigned = await _context.DoctorAssignments
            .AnyAsync(a => a.RaceId == raceEntry.RaceId && a.DoctorId == doctorId);
        if (!doctorAssigned)
            throw new InvalidOperationException("DOCTOR_NOT_ASSIGNED_TO_RACE");

        // Can sau dua la mot phan cua buoc "kiem tra lai sau tran" cung voi
        // kham lam sang sau tran (RecordPostRaceClinicalCheckAsync) — ca hai
        // deu chi thuc hien SAU khi Referee da bam ket thuc tran va co ket
        // qua so bo (Race.Status == "Unofficial"), khong con chan buoc
        // Referee ket thuc tran nhu truoc.
        if (raceEntry.Race.Status != "Unofficial")
            throw new InvalidOperationException("RACE_NOT_UNOFFICIAL");
        if (!raceEntry.PreRaceJockeyWeight.HasValue)
            throw new InvalidOperationException("PRE_RACE_WEIGHT_REQUIRED");

        var thresholdKg = raceEntry.Race.Round.Tournament.PostRaceWeightDiffThresholdKg;
        var difference = Math.Abs(dto.PostRaceJockeyWeight - raceEntry.PreRaceJockeyWeight.Value);
        var flagged = difference > thresholdKg;

        raceEntry.PostRaceJockeyWeight = dto.PostRaceJockeyWeight;
        raceEntry.PostRaceWeightByDoctorId = doctorId;
        raceEntry.PostRaceWeightFlagged = flagged;
        raceEntry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: doctorId,
            action: "Record_Post_Race_Weight",
            entityName: "RaceEntry",
            entityId: raceEntry.RaceEntryId.ToString(),
            newValue: $"PostRaceJockeyWeight={dto.PostRaceJockeyWeight}, PreRaceJockeyWeight={raceEntry.PreRaceJockeyWeight.Value}, " +
                      $"Difference={difference}, ThresholdKg={thresholdKg}, IsWeightFlagged={flagged}");

        // Giong pre-race: lech qua threshold phai DQ that su, khong duoc
        // chi flag roi cho pass.
        if (flagged)
        {
            await _emergencyDisqualificationService.DisqualifyAsync(
                doctorId,
                raceEntry.RaceEntryId,
                $"Cân nặng sau đua chênh lệch ({difference}kg) vượt quá ngưỡng ({thresholdKg}kg).",
                "MED.6_POST_RACE_WEIGHT_CHECK");
        }

        return new PostRaceWeightResultDto
        {
            RaceEntryId = raceEntry.RaceEntryId,
            RaceId = raceEntry.RaceId,
            DoctorId = doctor.DoctorId,
            PreRaceJockeyWeight = raceEntry.PreRaceJockeyWeight.Value,
            PostRaceJockeyWeight = dto.PostRaceJockeyWeight,
            WeightDifference = difference,
            ThresholdKg = thresholdKg,
            IsWeightFlagged = flagged,
            IsEmergencyDisqualified = flagged,
            RaceEntryStatus = raceEntry.Status,
            Message = flagged
                ? "Post-race weight difference exceeds the configured threshold. Race entry has been disqualified."
                : "Post-race weight recorded successfully."
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
        if (raceEntry.Race.Status == "Pre-Race")
        {
            // Starting list da duoc confirm chinh thuc -> khong cho sua du lieu tien dua nua.
            throw new InvalidOperationException("STARTING_LIST_ALREADY_CONFIRMED");
        }

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

        await _auditLog.LogAsync(
            actorId: doctorId,
            action: "Record_Horse_Identity_Check",
            entityName: "RaceEntry",
            entityId: raceEntry.RaceEntryId.ToString(),
            newValue: $"HorseIdentityCheckStatus={dto.HorseIdentityCheckStatus}");

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
        if (raceEntry.Race.Status == "Pre-Race")
        {
            // Starting list da duoc confirm chinh thuc -> khong cho sua du lieu tien dua nua.
            throw new InvalidOperationException("STARTING_LIST_ALREADY_CONFIRMED");
        }

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

        await _auditLog.LogAsync(
            actorId: doctorId,
            action: "Record_Clinical_Check",
            entityName: "RaceEntry",
            entityId: raceEntry.RaceEntryId.ToString(),
            newValue: $"ClinicalStatus={dto.ClinicalStatus}, UnfitReason={raceEntry.UnfitReason ?? "N/A"}");

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
    // =====================================================================
    // Doctor kham lam sang lai SAU tran (ca ngua + nai) — buoc bat buoc truoc
    // khi Admin Declare Official. Chi cho phep sau khi Referee da bam
    // "Ket thuc tran" va submit finish results (Race.Status == "Unofficial"),
    // dam bao trinh tu: bat dau tran -> ket thuc tran -> co ket qua so bo ->
    // doctor kham lai -> admin xem + cong bo chinh thuc.
    // =====================================================================
    public async Task<PostRaceClinicalCheckResultDto> RecordPostRaceClinicalCheckAsync(
        int doctorId,
        int raceEntryId,
        RecordPostRaceClinicalCheckDto dto)
    {
        var doctor = await ValidateDoctorAsync(doctorId);

        var raceEntry = await _context.RaceEntries
            .Include(e => e.Race)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Horse)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Jockey)
                    .ThenInclude(j => j.Jockey)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId);

        if (raceEntry == null)
            throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");

        var doctorAssigned = await _context.DoctorAssignments
            .AnyAsync(a => a.RaceId == raceEntry.RaceId && a.DoctorId == doctorId);
        if (!doctorAssigned)
            throw new InvalidOperationException("DOCTOR_NOT_ASSIGNED_TO_RACE");

        // DNF/Cancelled/Disqualified khong can kham lai sau tran — dung khong
        // hoan tat cuoc dua hoac da bi loai truoc do.
        if (raceEntry.Status == "Cancelled" || raceEntry.Status == "Disqualified" || raceEntry.IsWithdrawn)
            throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");

        // Chi cho kham lai SAU khi Referee da submit ket qua so bo (Live -> Unofficial).
        // Khong cho kham khi con dang Live (chua co ket qua) hay da Official (da khoa).
        if (raceEntry.Race.Status != "Unofficial")
            throw new InvalidOperationException("RACE_NOT_UNOFFICIAL");

        if (dto.PostRaceClinicalStatus == "Unfit" && string.IsNullOrWhiteSpace(dto.UnfitReason))
            throw new InvalidOperationException("UNFIT_REASON_REQUIRED");

        if (dto.PostRaceClinicalStatus == "Unfit" && dto.UnfitReason!.Trim().Length < 20)
            throw new InvalidOperationException("UNFIT_REASON_TOO_SHORT");

        var now = DateTime.UtcNow;

        raceEntry.PostRaceClinicalStatus = dto.PostRaceClinicalStatus;
        raceEntry.PostRaceClinicalCheckedByDoctorId = doctorId;
        raceEntry.PostRaceClinicalCheckedAt = now;
        raceEntry.PostRaceUnfitReason = dto.PostRaceClinicalStatus == "Unfit"
            ? dto.UnfitReason!.Trim()
            : null;
        raceEntry.UpdatedAt = now;

        var isUnfit = dto.PostRaceClinicalStatus == "Unfit";

        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: doctorId,
            action: "Record_Post_Race_Clinical_Check",
            entityName: "RaceEntry",
            entityId: raceEntry.RaceEntryId.ToString(),
            newValue: $"PostRaceClinicalStatus={dto.PostRaceClinicalStatus}, UnfitReason={raceEntry.PostRaceUnfitReason ?? "N/A"}");

        // Unfit sau tran van kich hoat DQ khan cap giong nhu truoc tran —
        // ket qua so bo cua entry nay se khong duoc tinh khi Admin Declare
        // Official (SettlePredictionsAsync/AllocatePurse deu loai Disqualified).
        if (isUnfit)
        {
            await _emergencyDisqualificationService.DisqualifyAsync(
                doctorId,
                raceEntry.RaceEntryId,
                raceEntry.PostRaceUnfitReason ?? "Unfit after race (post-race clinical check).",
                "MED.POST_RACE_CLINICAL_CHECK");
        }

        await _context.SaveChangesAsync();

        return new PostRaceClinicalCheckResultDto
        {
            RaceEntryId = raceEntry.RaceEntryId,
            RaceId = raceEntry.RaceId,
            DoctorId = doctorId,
            DoctorName = doctor.Doctor.FullName,
            HorseName = raceEntry.Pairing.Horse.Name,
            JockeyName = raceEntry.Pairing.Jockey.Jockey.FullName,
            PostRaceClinicalStatus = dto.PostRaceClinicalStatus,
            UnfitReason = raceEntry.PostRaceUnfitReason,
            IsEmergencyDisqualified = isUnfit,
            RaceEntryStatus = raceEntry.Status,
            Message = isUnfit
                ? "Horse/Jockey unfit after race. Race entry has been disqualified."
                : "Horse and jockey are confirmed fit after the race."
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
            .Include(x => x.Race)
            .Include(x => x.Pairing)
                .ThenInclude(p => p.Horse)
                    .ThenInclude(h => h.Owner)
                        .ThenInclude(o => o.Owner)
            .Include(x => x.Pairing)
                .ThenInclude(p => p.Jockey)
                    .ThenInclude(j => j.Jockey)
            .Select(x => new MedicalCheckListDto
            {
                RaceEntryId = x.RaceEntryId,

                PairingId = x.PairingId,

                PostPosition = x.PostPosition,

                HorseName = x.Pairing.Horse.Name,

                OwnerName = x.Pairing.Horse.Owner.Owner.FullName,

                JockeyName = x.Pairing.Jockey.Jockey.FullName,

                RaceEntryStatus = x.Status,

                SelfDeclaredWeight =
                    x.Pairing.Jockey.SelfDeclaredWeight,

                PreRaceWeight =
                    x.PreRaceJockeyWeight,

                HorseIdentityStatus =
                    x.HorseIdentityCheckStatus ?? "Pending",

                ClinicalStatus =
                    x.ClinicalStatus ?? "Pending",

                RaceStatus = x.Race.Status,

                PostRaceClinicalStatus =
                    x.PostRaceClinicalStatus ?? "Pending"
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
            .Include(e => e.PostRaceClinicalCheckedByDoctor)
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
            PostPosition = raceEntry.PostPosition,

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
            UnfitReason = raceEntry.UnfitReason,

            PostRaceClinicalStatus = raceEntry.PostRaceClinicalStatus,
            PostRaceClinicalCheckedByDoctorId = raceEntry.PostRaceClinicalCheckedByDoctorId,
            PostRaceClinicalCheckedByDoctorName = raceEntry.PostRaceClinicalCheckedByDoctor?.Doctor.FullName,
            PostRaceClinicalCheckedAt = raceEntry.PostRaceClinicalCheckedAt,
            PostRaceUnfitReason = raceEntry.PostRaceUnfitReason
        };
    }
}