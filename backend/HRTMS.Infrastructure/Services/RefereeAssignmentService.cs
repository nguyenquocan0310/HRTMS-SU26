using HRTMS.Core.DTOs.Referee;
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
        var raceExists = await _context.Races
            .AnyAsync(r => r.RaceId == raceId);

        if (!raceExists)
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

        // Kiem tra Referee da duoc gan vao Race nay chua
        var alreadyAssigned = await _context.RefereeAssignments
            .AnyAsync(a =>
                a.RaceId == raceId &&
                a.RefereeId == dto.RefereeId);

        if (alreadyAssigned)
        {
            throw new InvalidOperationException("REFEREE_ALREADY_ASSIGNED");
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
}