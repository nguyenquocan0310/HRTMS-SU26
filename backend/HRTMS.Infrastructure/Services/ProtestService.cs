using HRTMS.Core.DTOs.Protest;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class ProtestService : IProtestService
{
    private const int MaxProtestsPerUserPerRace = 3;
    private readonly HRTMSDbContext _context;
    private readonly INotificationService _notificationService;

    public ProtestService(HRTMSDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<ProtestDto> SubmitAsync(int submitterUserId, SubmitProtestDto dto)
    {
        var submitter = await _context.Users.AsNoTracking()
            .FirstOrDefaultAsync(user => user.UserId == submitterUserId)
            ?? throw new KeyNotFoundException("SUBMITTER_NOT_FOUND");
        if (submitter.Role is not ("Owner" or "Jockey"))
            throw new UnauthorizedAccessException("INVALID_PROTEST_ROLE");

        var race = await _context.Races
            .Include(r => r.RaceReport)
            .Include(r => r.RaceEntries).ThenInclude(entry => entry.Pairing).ThenInclude(pairing => pairing.Horse)
            .Include(r => r.RaceEntries).ThenInclude(entry => entry.Pairing).ThenInclude(pairing => pairing.Jockey)
            .FirstOrDefaultAsync(r => r.RaceId == dto.RaceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        EnsureSubmissionWindowOpen(race);

        var accusedEntry = race.RaceEntries.FirstOrDefault(entry => entry.RaceEntryId == dto.AccusedRaceEntryId)
            ?? throw new KeyNotFoundException("ACCUSED_ENTRY_NOT_IN_RACE");

        var submitterParticipates = race.RaceEntries.Any(entry =>
            entry.Status != "Cancelled" && !entry.IsWithdrawn && entry.Pairing.Status == "Confirmed" &&
            (entry.Pairing.Horse.OwnerId == submitterUserId || entry.Pairing.JockeyId == submitterUserId));
        if (!submitterParticipates)
            throw new UnauthorizedAccessException("SUBMITTER_NOT_PARTICIPANT");

        if (dto.ViolationId.HasValue)
        {
            var violationBelongsToRace = await _context.Violations
                .AnyAsync(violation => violation.ViolationId == dto.ViolationId.Value &&
                    violation.RaceReport.RaceId == race.RaceId);
            if (!violationBelongsToRace)
                throw new KeyNotFoundException("VIOLATION_NOT_IN_RACE");
        }

        var existingCount = await _context.Protests
            .CountAsync(protest => protest.RaceId == race.RaceId && protest.SubmittedByUserId == submitterUserId);
        if (existingCount >= MaxProtestsPerUserPerRace)
            throw new InvalidOperationException("PROTEST_LIMIT_REACHED");

        var protest = new Protest
        {
            RaceId = race.RaceId,
            SubmittedByUserId = submitterUserId,
            AccusedRaceEntryId = accusedEntry.RaceEntryId,
            ViolationId = dto.ViolationId,
            Description = dto.Description.Trim(),
            Status = "Pending",
            SubmittedAt = DateTime.UtcNow
        };
        _context.Protests.Add(protest);
        await _context.SaveChangesAsync();
        return ToDto(protest);
    }

    public async Task<ProtestRulingResultDto> RuleAsync(int refereeId, int protestId, RuleProtestDto dto)
    {
        var protest = await _context.Protests
            .Include(item => item.Race).ThenInclude(race => race.RaceReport)
            .Include(item => item.Race).ThenInclude(race => race.RaceEntries).ThenInclude(entry => entry.Pairing).ThenInclude(pairing => pairing.Horse)
            .Include(item => item.Race).ThenInclude(race => race.RaceEntries).ThenInclude(entry => entry.Pairing).ThenInclude(pairing => pairing.Jockey)
            .FirstOrDefaultAsync(item => item.ProtestId == protestId)
            ?? throw new KeyNotFoundException("PROTEST_NOT_FOUND");

        var race = protest.Race;
        await EnsureRefereeAssignedAsync(race.RaceId, refereeId);
        EnsureRaceReportOpen(race);
        if (protest.Status != "Pending")
            throw new InvalidOperationException("PROTEST_ALREADY_RESOLVED");
        if (dto.Decision == "Approved" && string.IsNullOrWhiteSpace(dto.Penalty))
            throw new ArgumentException("PENALTY_REQUIRED");
        if (dto.Decision == "Rejected" && dto.Penalty != null)
            throw new ArgumentException("PENALTY_NOT_ALLOWED");
        if (dto.Penalty == "PlaceBehind" && !dto.PlaceBehindEntryId.HasValue)
            throw new ArgumentException("PLACE_BEHIND_ENTRY_REQUIRED");

        var accusedEntry = race.RaceEntries.First(entry => entry.RaceEntryId == protest.AccusedRaceEntryId);
        if (dto.PlaceBehindEntryId.HasValue)
        {
            var target = race.RaceEntries.FirstOrDefault(entry => entry.RaceEntryId == dto.PlaceBehindEntryId.Value);
            if (target == null || target.Status is "Cancelled" or "Disqualified" || target.IsWithdrawn)
                throw new KeyNotFoundException("PLACE_BEHIND_ENTRY_NOT_FOUND");
            if (target.RaceEntryId == accusedEntry.RaceEntryId)
                throw new ArgumentException("PLACE_BEHIND_ENTRY_SAME_AS_ACCUSED");
        }

        using var transaction = await _context.Database.BeginTransactionAsync();
        var now = DateTime.UtcNow;
        if (dto.Decision == "Approved")
            ApplyPenalty(race.RaceEntries, accusedEntry, dto.Penalty!, dto.PlaceBehindEntryId, protest.Description);

        NormalizeRankings(race.RaceEntries);
        protest.Status = dto.Decision == "Approved" ? "Approved" : "Rejected";
        protest.PenaltyApplied = dto.Decision == "Approved" ? dto.Penalty : null;
        protest.RefereeDecision = dto.Notes.Trim();
        protest.ResolvedAt = now;
        race.UpdatedAt = now;
        foreach (var entry in race.RaceEntries)
            entry.UpdatedAt = now;
        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        var recipients = new[]
        {
            protest.SubmittedByUserId,
            accusedEntry.Pairing.Horse.OwnerId,
            accusedEntry.Pairing.JockeyId
        };
        var rankingMessage = BuildRankingMessage(race.RaceEntries);
        await _notificationService.SendBulkAsync(
            recipients,
            "Phán quyết khiếu nại cuộc đua",
            $"Khiếu nại #{protest.ProtestId} đã được {protest.Status}. " +
            $"Hình phạt: {protest.PenaltyApplied ?? "Không áp dụng"}. " +
            $"Thứ hạng hiện tại: {rankingMessage}",
            type: "Both",
            relatedEntityType: "Protest",
            relatedEntityId: protest.ProtestId);

        return new ProtestRulingResultDto
        {
            Protest = ToDto(protest),
            Rankings = race.RaceEntries
                .OrderBy(entry => entry.FinishPosition ?? int.MaxValue)
                .ThenBy(entry => entry.RaceEntryId)
                .Select(entry => new RankedRaceEntryDto
                {
                    RaceEntryId = entry.RaceEntryId,
                    FinishPosition = entry.FinishPosition,
                    Status = entry.Status
                })
                .ToList()
        };
    }

    public async Task<IReadOnlyList<ProtestDto>> GetByRaceAsync(int raceId)
    {
        var exists = await _context.Races.AnyAsync(race => race.RaceId == raceId);
        if (!exists) throw new KeyNotFoundException("RACE_NOT_FOUND");

        return await _context.Protests.AsNoTracking()
            .Where(protest => protest.RaceId == raceId)
            .OrderByDescending(protest => protest.SubmittedAt)
            .Select(protest => new ProtestDto
            {
                ProtestId = protest.ProtestId,
                RaceId = protest.RaceId,
                SubmittedByUserId = protest.SubmittedByUserId,
                AccusedRaceEntryId = protest.AccusedRaceEntryId,
                ViolationId = protest.ViolationId,
                Description = protest.Description,
                Status = protest.Status,
                RefereeDecision = protest.RefereeDecision,
                PenaltyApplied = protest.PenaltyApplied,
                SubmittedAt = protest.SubmittedAt,
                ResolvedAt = protest.ResolvedAt
            })
            .ToListAsync();
    }

    private static void EnsureSubmissionWindowOpen(Race race)
    {
        EnsureRaceReportOpen(race);
        if (ProtestWindowPolicy.IsClosed(race, DateTime.UtcNow))
            throw new InvalidOperationException("PROTEST_WINDOW_CLOSED");
    }

    private static void EnsureRaceReportOpen(Race race)
    {
        if (race.Status != "Unofficial")
            throw new InvalidOperationException("RACE_NOT_UNOFFICIAL");
        if (race.RaceReport == null || race.RaceReport.IsLocked)
            throw new InvalidOperationException("RACE_REPORT_LOCKED");
    }

    private const int MinCloseWindowMinutes = 5;

    public async Task CloseWindowEarlyAsync(int raceId, int refereeId)
    {
        var race = await _context.Races
            .Include(r => r.RaceReport)
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        await EnsureRefereeAssignedAsync(raceId, refereeId);
        EnsureRaceReportOpen(race);

        if (race.RaceReport!.ProtestWindowClosedAt != null)
            throw new InvalidOperationException("PROTEST_WINDOW_ALREADY_CLOSED");

        var now = DateTime.UtcNow;
        if (now < race.RaceReport.SubmittedAt.AddMinutes(MinCloseWindowMinutes))
            throw new InvalidOperationException("MIN_WINDOW_NOT_ELAPSED");

        race.RaceReport.ProtestWindowClosedAt = now;
        await _context.SaveChangesAsync();
    }

    private async Task EnsureRefereeAssignedAsync(int raceId, int refereeId)
    {
        var assigned = await _context.RefereeAssignments
            .AnyAsync(assignment => assignment.RaceId == raceId && assignment.RefereeId == refereeId);
        if (!assigned) throw new UnauthorizedAccessException("REFEREE_NOT_ASSIGNED_TO_RACE");
    }

    private static void ApplyPenalty(
        IEnumerable<RaceEntry> entries,
        RaceEntry accused,
        string penalty,
        int? placeBehindEntryId,
        string reason)
    {
        switch (penalty)
        {
            case "Disqualified":
                accused.Status = "Disqualified";
                accused.FinishPosition = null;
                break;
            case "Scratch":
                accused.Status = "Cancelled";
                accused.IsWithdrawn = true;
                accused.WithdrawalReason = $"Scratch from protest: {reason}";
                accused.FinishPosition = null;
                break;
            case "PlaceBehind":
                MoveBehind(entries, accused, placeBehindEntryId!.Value);
                break;
            case "Warning":
                break;
            default:
                throw new ArgumentException("INVALID_PENALTY");
        }
    }

    private static void MoveBehind(IEnumerable<RaceEntry> entries, RaceEntry accused, int targetEntryId)
    {
        var ordered = entries
            .Where(entry => entry.Status != "Cancelled" && entry.Status != "Disqualified" && !entry.IsWithdrawn)
            .OrderBy(entry => entry.FinishPosition ?? int.MaxValue)
            .ThenBy(entry => entry.RaceEntryId)
            .ToList();
        ordered.Remove(accused);
        var targetIndex = ordered.FindIndex(entry => entry.RaceEntryId == targetEntryId);
        ordered.Insert(targetIndex + 1, accused);
        for (var index = 0; index < ordered.Count; index++)
            ordered[index].FinishPosition = index + 1;
    }

    private static void NormalizeRankings(IEnumerable<RaceEntry> entries)
    {
        var activeEntries = entries
            .Where(entry => entry.Status != "Cancelled" && entry.Status != "Disqualified" && !entry.IsWithdrawn)
            .OrderBy(entry => entry.FinishPosition ?? int.MaxValue)
            .ThenBy(entry => entry.RaceEntryId)
            .ToList();

        var nextPosition = 1;
        foreach (var group in activeEntries.GroupBy(entry => entry.FinishPosition))
        {
            foreach (var entry in group)
                entry.FinishPosition = nextPosition;
            nextPosition += group.Count();
        }
    }

    private static string BuildRankingMessage(IEnumerable<RaceEntry> entries) => string.Join(", ", entries
        .Where(entry => entry.FinishPosition.HasValue)
        .OrderBy(entry => entry.FinishPosition)
        .ThenBy(entry => entry.RaceEntryId)
        .Select(entry => $"Entry {entry.RaceEntryId}: hạng {entry.FinishPosition}"));

    private static ProtestDto ToDto(Protest protest) => new()
    {
        ProtestId = protest.ProtestId,
        RaceId = protest.RaceId,
        SubmittedByUserId = protest.SubmittedByUserId,
        AccusedRaceEntryId = protest.AccusedRaceEntryId,
        ViolationId = protest.ViolationId,
        Description = protest.Description,
        Status = protest.Status,
        RefereeDecision = protest.RefereeDecision,
        PenaltyApplied = protest.PenaltyApplied,
        SubmittedAt = protest.SubmittedAt,
        ResolvedAt = protest.ResolvedAt
    };
}