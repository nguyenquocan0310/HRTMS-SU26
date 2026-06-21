using HRTMS.Core.DTOs.Medical;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class MedicalCheckService : IMedicalCheckService
{
    private readonly HRTMSDbContext _context;

    public MedicalCheckService(HRTMSDbContext context)
    {
        _context = context;
    }

    public async Task<PreRaceWeightResultDto> RecordPreRaceWeightAsync(
        int doctorId,
        int raceEntryId,
        RecordPreRaceWeightDto dto)
    {
        // Kiem tra Doctor co ton tai va dang Active hay khong
        var doctor = await _context.DoctorProfiles
            .Include(d => d.Doctor)
            .FirstOrDefaultAsync(d => d.DoctorId == doctorId);

        if (doctor == null)
        {
            throw new KeyNotFoundException("DOCTOR_NOT_FOUND");
        }

        if (doctor.Doctor.Role != "Doctor")
        {
            throw new InvalidOperationException("USER_NOT_DOCTOR");
        }

        if (doctor.Status != "Active")
        {
            throw new InvalidOperationException("DOCTOR_NOT_ACTIVE");
        }

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
}