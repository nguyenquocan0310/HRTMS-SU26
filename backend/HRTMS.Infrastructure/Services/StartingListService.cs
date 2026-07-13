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

        // Phai da boc tham cong (Draw Post Position) truoc khi chot starting list.
        // Chan kich ban confirm official starting list khi race chua tung boc tham.
        if (!race.IsPostPositionDrawn)
        {
            throw new InvalidOperationException("RACE_NOT_DRAWN");
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

                // Persist viec loai entry khong du dieu kien y te/eligibility khoi race that.
                // Chi withdraw entry dang con hieu luc (Confirmed & chua withdrawn) -> tranh
                // hoi sinh entry da Cancelled hoac withdraw nham entry chi thieu buoc khac.
                if (entry.Status == "Confirmed" && !entry.IsWithdrawn)
                {
                    entry.IsWithdrawn = true;
                    entry.WithdrawalReason = rejectionReason;
                    entry.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        if (!confirmedEntries.Any())
        {
            throw new InvalidOperationException("NO_ELIGIBLE_STARTING_ENTRIES");
        }

        // Danh sach xuat phat da duoc confirm chinh thuc -> KHOA lai bang cach chuyen
        // Race sang "Pre-Race". Tu day 4 buoc check (weight/identity/clinical/independence)
        // va Withdraw deu bi chan (guard != "Upcoming"), chi con Start Race di tiep.
        // Bọc transaction de update reject entries + doi status la nguyen tu.
        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            race.Status = "Pre-Race";
            race.IsPostPositionDrawn = true;
            race.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

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
