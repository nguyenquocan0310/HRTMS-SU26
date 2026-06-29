using HRTMS.Core.DTOs.RaceEntry;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class StartingListService : IStartingListService
{
    private readonly HRTMSDbContext _context;

    public StartingListService(HRTMSDbContext context)
    {
        _context = context;
    }

    public async Task<ConfirmStartingListResultDto> ConfirmStartingListAsync(
        int refereeId,
        int raceId)
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

        // Race phai ton tai
        var race = await _context.Races
            .FirstOrDefaultAsync(r => r.RaceId == raceId);

        if (race == null)
        {
            throw new KeyNotFoundException("RACE_NOT_FOUND");
        }

        // Referee phai duoc phan cong vao Race nay
        var refereeAssigned = await _context.RefereeAssignments
            .AnyAsync(a =>
                a.RaceId == raceId &&
                a.RefereeId == refereeId);

        if (!refereeAssigned)
        {
            throw new InvalidOperationException("REFEREE_NOT_ASSIGNED_TO_RACE");
        }

        // Chi confirm starting list khi Race con Upcoming
        if (race.Status != "Upcoming")
        {
            throw new InvalidOperationException("RACE_NOT_UPCOMING");
        }

        var entries = await _context.RaceEntries
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Horse)
                    .ThenInclude(h => h.Owner)
                        .ThenInclude(o => o.Owner)
            .Include(e => e.Pairing)
                .ThenInclude(p => p.Jockey)
                    .ThenInclude(j => j.Jockey)
            .Where(e => e.RaceId == raceId)
            .OrderBy(e => e.PostPosition)
            .ThenBy(e => e.RaceEntryId)
            .ToListAsync();

        if (!entries.Any())
        {
            throw new InvalidOperationException("NO_RACE_ENTRIES");
        }

        var confirmedEntries = new List<StartingListEntryDto>();
        var rejectedEntries = new List<StartingListEntryDto>();

        foreach (var entry in entries)
        {
            var rejectionReason = GetRejectionReason(entry);

            var dto = new StartingListEntryDto
            {
                RaceEntryId = entry.RaceEntryId,
                RaceId = entry.RaceId,
                PairingId = entry.PairingId,
                HorseName = entry.Pairing.Horse.Name,
                JockeyName = entry.Pairing.Jockey.Jockey.FullName,
                OwnerName = entry.Pairing.Horse.Owner.Owner.FullName,
                PostPosition = entry.PostPosition,
                Status = entry.Status,
                PreRaceJockeyWeight = entry.PreRaceJockeyWeight,
                HorseIdentityCheckStatus = entry.HorseIdentityCheckStatus,
                ClinicalStatus = entry.ClinicalStatus,
                IndependenceCheckStatus = entry.IndependenceCheckStatus,
                RejectionReason = rejectionReason
            };

            if (rejectionReason == null)
            {
                confirmedEntries.Add(dto);
            }
            else
            {
                rejectedEntries.Add(dto);
            }
        }

        if (!confirmedEntries.Any())
        {
            throw new InvalidOperationException("NO_ELIGIBLE_STARTING_ENTRIES");
        }

        // Danh sach xuat phat da duoc confirm.
        // Hien schema chua co bang StartingList rieng, nen cap nhat Race flag/status toi muc an toan.
        race.IsPostPositionDrawn = true;
        race.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new ConfirmStartingListResultDto
        {
            RaceId = raceId,
            ConfirmedEntriesCount = confirmedEntries.Count,
            RejectedEntriesCount = rejectedEntries.Count,
            ConfirmedEntries = confirmedEntries,
            RejectedEntries = rejectedEntries,
            Message = "Official starting list confirmed successfully."
        };
    }

    private static string? GetRejectionReason(HRTMS.Core.Entities.RaceEntry entry)
    {
        if (entry.IsWithdrawn)
        {
            return "Race entry was withdrawn.";
        }

        if (entry.Status != "Confirmed")
        {
            return $"Race entry status is {entry.Status}.";
        }

        if (entry.PreRaceJockeyWeight == null)
        {
            return "Pre-race jockey weight has not been recorded.";
        }

        if (entry.HorseIdentityCheckStatus != "Matched")
        {
            return "Horse identity has not been matched.";
        }

        if (entry.ClinicalStatus != "Fit")
        {
            return "Horse clinical status is not Fit.";
        }

        if (entry.IndependenceCheckStatus != "Passed")
        {
            return "Jockey independence check has not passed.";
        }

        return null;
    }
}