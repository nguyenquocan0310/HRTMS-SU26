using HRTMS.Core.DTOs.Doctor;
using HRTMS.Core.DTOs.Assignment;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class DoctorAssignmentService : IDoctorAssignmentService
{
    private readonly HRTMSDbContext _context;

    public DoctorAssignmentService(HRTMSDbContext context)
    {
        _context = context;
    }

    public async Task<DoctorAssignmentDto> AssignAsync(
        int raceId,
        AssignDoctorDto dto)
    {
        // Lay Race de kiem tra ton tai va thoi gian thi dau
        var race = await _context.Races
            .FirstOrDefaultAsync(r => r.RaceId == raceId);

        if (race == null)
        {
            throw new KeyNotFoundException("RACE_NOT_FOUND");
        }

        // Lay thong tin Doctor profile va User
        var doctor = await _context.DoctorProfiles
            .Include(d => d.Doctor)
            .FirstOrDefaultAsync(d => d.DoctorId == dto.DoctorId);

        if (doctor == null)
        {
            throw new KeyNotFoundException("DOCTOR_NOT_FOUND");
        }

        // Kiem tra user co dung role Doctor hay khong
        if (doctor.Doctor.Role != "Doctor")
        {
            throw new InvalidOperationException("USER_NOT_DOCTOR");
        }

        // Chi Doctor Active moi duoc gan vao Race
        if (doctor.Status != "Active")
        {
            throw new InvalidOperationException("DOCTOR_NOT_ACTIVE");
        }

        // Doctor phai co trong roster Approved cua giai chua Race nay
        var tournamentId = await _context.Races
            .Where(r => r.RaceId == raceId)
            .Select(r => r.Round.TournamentId)
            .FirstOrDefaultAsync();

        var doctorInRoster = await _context.TournamentParticipants.AnyAsync(p =>
            p.TournamentId == tournamentId &&
            p.UserId == dto.DoctorId &&
            p.Role == "Doctor" &&
            p.Status == "Approved");

        if (!doctorInRoster)
        {
            throw new InvalidOperationException("DOCTOR_NOT_IN_TOURNAMENT_ROSTER");
        }

        // Kiem tra Doctor da duoc gan vao Race nay chua
        var alreadyAssigned = await _context.DoctorAssignments
            .AnyAsync(a =>
                a.RaceId == raceId &&
                a.DoctorId == dto.DoctorId);

        if (alreadyAssigned)
        {
            throw new InvalidOperationException("DOCTOR_ALREADY_ASSIGNED");
        }

        // Kiem tra Doctor co bi trung lich voi Race khac cung gio khong
        var doctorHasRaceAtSameTime = await _context.DoctorAssignments
            .Include(a => a.Race)
            .AnyAsync(a =>
                a.DoctorId == dto.DoctorId &&
                a.RaceId != raceId &&
                a.Race.ScheduledTime == race.ScheduledTime &&
                a.Race.Status != "Cancelled");

        if (doctorHasRaceAtSameTime)
        {
            throw new InvalidOperationException("DOCTOR_DOUBLE_BOOKED");
        }

        var now = DateTime.UtcNow;

        var assignment = new DoctorAssignment
        {
            RaceId = raceId,
            DoctorId = dto.DoctorId,
            AssignedAt = now,
            CertifiedAt = now
        };

        _context.DoctorAssignments.Add(assignment);
        await _context.SaveChangesAsync();

        return new DoctorAssignmentDto
        {
            RaceId = assignment.RaceId,
            DoctorId = assignment.DoctorId,
            DoctorName = doctor.Doctor.FullName,
            DoctorEmail = doctor.Doctor.Email,
            MedicalLicenseNumber = doctor.MedicalLicenseNumber,
            AssignedAt = assignment.AssignedAt,
            CertifiedAt = assignment.CertifiedAt
        };
    }

    public async Task<List<DoctorAssignmentDto>> GetByRaceAsync(
        int raceId)
    {
        // Kiem tra Race co ton tai hay khong
        var raceExists = await _context.Races
            .AnyAsync(r => r.RaceId == raceId);

        if (!raceExists)
        {
            throw new KeyNotFoundException("RACE_NOT_FOUND");
        }

        // Lay danh sach Doctor da duoc gan vao Race
        var assignments = await _context.DoctorAssignments
            .Include(a => a.Doctor)
                .ThenInclude(d => d.Doctor)
            .Where(a => a.RaceId == raceId)
            .Select(a => new DoctorAssignmentDto
            {
                RaceId = a.RaceId,
                DoctorId = a.DoctorId,
                DoctorName = a.Doctor.Doctor.FullName,
                DoctorEmail = a.Doctor.Doctor.Email,
                MedicalLicenseNumber = a.Doctor.MedicalLicenseNumber,
                AssignedAt = a.AssignedAt,
                CertifiedAt = a.CertifiedAt
            })
            .ToListAsync();

        return assignments;
    }

    public async Task RemoveAsync(
        int raceId,
        int doctorId)
    {
        // Tim assignment can go khoi Race
        var assignment = await _context.DoctorAssignments
            .FirstOrDefaultAsync(a =>
                a.RaceId == raceId &&
                a.DoctorId == doctorId);

        if (assignment == null)
        {
            throw new KeyNotFoundException("DOCTOR_ASSIGNMENT_NOT_FOUND");
        }

        _context.DoctorAssignments.Remove(assignment);
        await _context.SaveChangesAsync();
    }
    public async Task<List<MyRaceAssignmentDto>> GetMyAssignmentsAsync(
    int doctorId)
{
    // Lay danh sach Race ma Doctor duoc phan cong
    var assignments = await _context.DoctorAssignments
        .AsNoTracking()
        .Include(a => a.Race)
            .ThenInclude(r => r.Round)
                .ThenInclude(round => round.Tournament)
        .Where(a => a.DoctorId == doctorId)
        .OrderBy(a => a.Race.ScheduledTime)
        .Select(a => new MyRaceAssignmentDto
        {
            RaceId = a.RaceId,
            RaceNumber = a.Race.RaceNumber,
            ScheduledTime = a.Race.ScheduledTime,
            RaceStatus = a.Race.Status,
            RoundId = a.Race.RoundId,
            RoundName = a.Race.Round.Name,
            TournamentId = a.Race.Round.TournamentId,
            TournamentName = a.Race.Round.Tournament.Name,

            // DoctorAssignment khong co Role
            AssignmentRole = null,

            AssignedAt = a.AssignedAt
        })
        .ToListAsync();

    return assignments;
}
}