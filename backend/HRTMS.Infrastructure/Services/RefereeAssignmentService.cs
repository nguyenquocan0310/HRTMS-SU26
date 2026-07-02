using HRTMS.Core.DTOs.Referee;
using HRTMS.Core.DTOs.Assignment;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class RefereeAssignmentService : IRefereeAssignmentService
{
    private readonly HRTMSDbContext _context;

    public RefereeAssignmentService(HRTMSDbContext context)
    {
        _context = context;
    }

    public async Task<RefereeAssignmentDto> AssignAsync(
        int raceId,
        AssignRefereeDto dto)
    {
        // Kiem tra Race co ton tai hay khong
        // Lay Race de kiem tra ton tai va thoi gian thi dau
        var race = await _context.Races
            .FirstOrDefaultAsync(r => r.RaceId == raceId);

        if (race == null)
        {
            throw new KeyNotFoundException("RACE_NOT_FOUND");
        }

        // Lay thong tin Referee profile va User
        var referee = await _context.RefereeProfiles
            .Include(r => r.Referee)
            .FirstOrDefaultAsync(r => r.RefereeId == dto.RefereeId);

        if (referee == null)
        {
            throw new KeyNotFoundException("REFEREE_NOT_FOUND");
        }

        // Kiem tra user co dung role Referee hay khong
        if (referee.Referee.Role != "Referee")
        {
            throw new InvalidOperationException("USER_NOT_REFEREE");
        }

        // Chi Referee Active moi duoc gan vao Race
        if (referee.Status != "Active")
        {
            throw new InvalidOperationException("REFEREE_NOT_ACTIVE");
        }

        // Referee phai co trong roster Approved cua giai chua Race nay
        var tournamentId = await _context.Races
            .Where(r => r.RaceId == raceId)
            .Select(r => r.Round.TournamentId)
            .FirstOrDefaultAsync();

        var refereeInRoster = await _context.TournamentParticipants.AnyAsync(p =>
            p.TournamentId == tournamentId &&
            p.UserId == dto.RefereeId &&
            p.Role == "Referee" &&
            p.Status == "Approved");

        if (!refereeInRoster)
        {
            throw new InvalidOperationException("REFEREE_NOT_IN_TOURNAMENT_ROSTER");
        }

        // Kiem tra Referee da duoc gan vao Race nay chua
        var alreadyAssigned = await _context.RefereeAssignments
            .AnyAsync(a =>
                a.RaceId == raceId &&
                a.RefereeId == dto.RefereeId);

        if (alreadyAssigned)
        {
            throw new InvalidOperationException("REFEREE_ALREADY_ASSIGNED");
        }
        // Kiem tra Referee co bi trung lich voi Race khac cung gio khong
        var refereeHasRaceAtSameTime = await _context.RefereeAssignments
            .Include(a => a.Race)
            .AnyAsync(a =>
                a.RefereeId == dto.RefereeId &&
                a.RaceId != raceId &&
                a.Race.ScheduledTime == race.ScheduledTime &&
                a.Race.Status != "Cancelled");

        if (refereeHasRaceAtSameTime)
        {
            throw new InvalidOperationException("REFEREE_DOUBLE_BOOKED");
        }

        // Moi Race chi duoc co mot Lead Referee
        if (dto.Role == "Lead Referee")
        {
            var leadAlreadyExists = await _context.RefereeAssignments
                .AnyAsync(a =>
                    a.RaceId == raceId &&
                    a.Role == "Lead Referee");

            if (leadAlreadyExists)
            {
                throw new InvalidOperationException("LEAD_REFEREE_ALREADY_EXISTS");
            }
        }
        // Kiem tra COI cua Referee voi Owner co ngua trong Race
        // Referee khong duoc la Spouse, Parent, Child, Sibling cua bat ky Owner nao trong Race
        var ownerIdsInRace = await (
            from raceEntry in _context.RaceEntries
            join pairing in _context.Pairings
                on raceEntry.PairingId equals pairing.PairingId
            join horse in _context.Horses
                on pairing.HorseId equals horse.HorseId
            where raceEntry.RaceId == raceId
                  && raceEntry.Status != "Cancelled"
            select horse.OwnerId
        )
                .Distinct()
                .ToListAsync();

        var directFamilyRelations = new[]
        {
                "Spouse",
                "Parent",
                "Child",
                "Sibling"
};

        var hasConflictOfInterest = await _context.FamilyRelationshipDeclarations
                .AnyAsync(f =>
                f.RelatedUserId.HasValue &&
                directFamilyRelations.Contains(f.RelationType) &&
                (
            (
                f.DeclarantUserId == dto.RefereeId &&
                ownerIdsInRace.Contains(f.RelatedUserId.Value)
            )
            ||
            (
                ownerIdsInRace.Contains(f.DeclarantUserId) &&
                f.RelatedUserId.Value == dto.RefereeId
            )
        ));

        if (hasConflictOfInterest)
        {
            throw new InvalidOperationException(
                "REFEREE_CONFLICT_OF_INTEREST");
        }

        var now = DateTime.UtcNow;

        var assignment = new RefereeAssignment
        {
            RaceId = raceId,
            RefereeId = dto.RefereeId,
            Role = dto.Role,
            AssignedAt = now
        };

        _context.RefereeAssignments.Add(assignment);
        await _context.SaveChangesAsync();

        return new RefereeAssignmentDto
        {
            RaceId = assignment.RaceId,
            RefereeId = assignment.RefereeId,
            RefereeName = referee.Referee.FullName,
            RefereeEmail = referee.Referee.Email,
            CertificationLevel = referee.CertificationLevel,
            Role = assignment.Role,
            AssignedAt = assignment.AssignedAt
        };
    }

    public async Task<List<RefereeAssignmentDto>> GetByRaceAsync(
        int raceId)
    {
        // Kiem tra Race co ton tai hay khong
        var raceExists = await _context.Races
            .AnyAsync(r => r.RaceId == raceId);

        if (!raceExists)
        {
            throw new KeyNotFoundException("RACE_NOT_FOUND");
        }

        // Lay danh sach Referee da duoc gan vao Race
        var assignments = await _context.RefereeAssignments
            .Include(a => a.Referee)
                .ThenInclude(r => r.Referee)
            .Where(a => a.RaceId == raceId)
            .Select(a => new RefereeAssignmentDto
            {
                RaceId = a.RaceId,
                RefereeId = a.RefereeId,
                RefereeName = a.Referee.Referee.FullName,
                RefereeEmail = a.Referee.Referee.Email,
                CertificationLevel = a.Referee.CertificationLevel,
                Role = a.Role,
                AssignedAt = a.AssignedAt
            })
            .ToListAsync();

        return assignments;
    }

    public async Task RemoveAsync(
        int raceId,
        int refereeId)
    {
        // Tim assignment can go khoi Race
        var assignment = await _context.RefereeAssignments
            .FirstOrDefaultAsync(a =>
                a.RaceId == raceId &&
                a.RefereeId == refereeId);

        if (assignment == null)
        {
            throw new KeyNotFoundException("REFEREE_ASSIGNMENT_NOT_FOUND");
        }

        _context.RefereeAssignments.Remove(assignment);
        await _context.SaveChangesAsync();
    }
    public async Task<List<MyRaceAssignmentDto>> GetMyAssignmentsAsync(
    int refereeId)
{
    // Lay danh sach Race ma Referee duoc phan cong
    var assignments = await _context.RefereeAssignments
        .AsNoTracking()
        .Include(a => a.Race)
            .ThenInclude(r => r.Round)
                .ThenInclude(round => round.Tournament)
        .Where(a => a.RefereeId == refereeId)
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

            // RefereeAssignment co Role
            AssignmentRole = a.Role,

            AssignedAt = a.AssignedAt
        })
        .ToListAsync();

    return assignments;
}
}