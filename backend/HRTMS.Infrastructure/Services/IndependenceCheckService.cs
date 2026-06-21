using HRTMS.Core.DTOs.Referee;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class IndependenceCheckService : IIndependenceCheckService
{
    private readonly HRTMSDbContext _context;

    public IndependenceCheckService(HRTMSDbContext context)
    {
        _context = context;
    }

    public async Task<IndependenceCheckResultDto> CheckJockeyIndependenceAsync(
        int refereeId,
        int raceEntryId)
    {
        // Kiem tra Referee co ton tai va dang Active hay khong
        var referee = await _context.RefereeProfiles
            .Include(r => r.Referee)
            .FirstOrDefaultAsync(r => r.RefereeId == refereeId);

        if (referee == null)
        {
            throw new KeyNotFoundException("REFEREE_NOT_FOUND");
        }

        if (referee.Referee.Role != "Referee")
        {
            throw new InvalidOperationException("USER_NOT_REFEREE");
        }

        if (referee.Status != "Active")
        {
            throw new InvalidOperationException("REFEREE_NOT_ACTIVE");
        }

        // Lay RaceEntry can kiem tra
        var raceEntry = await _context.RaceEntries
            .Include(e => e.Race)
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

        // Referee phai duoc phan cong vao Race nay moi duoc check
        var refereeAssigned = await _context.RefereeAssignments
            .AnyAsync(a =>
                a.RaceId == raceEntry.RaceId &&
                a.RefereeId == refereeId);

        if (!refereeAssigned)
        {
            throw new InvalidOperationException("REFEREE_NOT_ASSIGNED_TO_RACE");
        }

        // Chi RaceEntry hop le moi duoc check
        if (raceEntry.Status == "Cancelled" ||
            raceEntry.Status == "Disqualified" ||
            raceEntry.IsWithdrawn)
        {
            throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");
        }

        // Chi cho check truoc khi Race bat dau
        if (raceEntry.Race.Status != "Upcoming")
        {
            throw new InvalidOperationException("RACE_NOT_UPCOMING");
        }

        var jockeyId = raceEntry.Pairing.JockeyId;
        var currentOwnerId = raceEntry.Pairing.Horse.OwnerId;

        // Lay danh sach Owner doi thu trong cung Race
        var opposingOwnerIds = await _context.RaceEntries
            .Where(e =>
                e.RaceId == raceEntry.RaceId &&
                e.RaceEntryId != raceEntryId &&
                e.Status != "Cancelled" &&
                !e.IsWithdrawn)
            .Select(e => e.Pairing.Horse.OwnerId)
            .Where(ownerId => ownerId != currentOwnerId)
            .Distinct()
            .ToListAsync();

        var directRelations = new[]
        {
            "Spouse",
            "Parent",
            "Child",
            "Sibling"
        };

        // Kiem tra Jockey co quan he gia dinh voi Owner doi thu hay khong
        var conflict = await _context.FamilyRelationshipDeclarations
            .Where(d =>
                directRelations.Contains(d.RelationType) &&
                (
                    (
                        d.DeclarantUserId == jockeyId &&
                        d.RelatedUserId.HasValue &&
                        opposingOwnerIds.Contains(d.RelatedUserId.Value)
                    )
                    ||
                    (
                        d.RelatedUserId == jockeyId &&
                        opposingOwnerIds.Contains(d.DeclarantUserId)
                    )
                ))
            .FirstOrDefaultAsync();

        var now = DateTime.UtcNow;

        raceEntry.IndependenceCheckedByRefereeId = refereeId;
        raceEntry.IndependenceCheckedAt = now;
        raceEntry.UpdatedAt = now;

        var isFailed = conflict != null;

        if (isFailed)
        {
            var violationReason =
                $"Jockey has direct family relationship with an opposing owner. RelationType: {conflict!.RelationType}.";

            raceEntry.IndependenceCheckStatus = "Failed";
            raceEntry.IndependenceViolationReason = violationReason;

            // MED.6: Vi pham se kich hoat Emergency DQ
            // Ban hien tai xu ly DQ toi thieu: cap nhat RaceEntry thanh Disqualified
            // Phan ACID refund + notification + audit se lam o MED.7
            raceEntry.Status = "Disqualified";
        }
        else
        {
            raceEntry.IndependenceCheckStatus = "Passed";
            raceEntry.IndependenceViolationReason = null;
        }

        await _context.SaveChangesAsync();

        return new IndependenceCheckResultDto
        {
            RaceEntryId = raceEntry.RaceEntryId,
            RaceId = raceEntry.RaceId,
            RefereeId = refereeId,
            RefereeName = referee.Referee.FullName,
            HorseName = raceEntry.Pairing.Horse.Name,
            JockeyId = jockeyId,
            JockeyName = raceEntry.Pairing.Jockey.Jockey.FullName,
            IndependenceCheckStatus = raceEntry.IndependenceCheckStatus!,
            IsEmergencyDisqualified = isFailed,
            ViolationReason = raceEntry.IndependenceViolationReason,
            RaceEntryStatus = raceEntry.Status,
            Message = isFailed
                ? "Jockey independence check failed. Race entry has been disqualified."
                : "Jockey independence check passed."
        };
    }
}