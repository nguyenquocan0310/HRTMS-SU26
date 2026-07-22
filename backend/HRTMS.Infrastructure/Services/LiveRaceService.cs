using HRTMS.Core.DTOs.LiveRace;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

/// <summary>
/// Module H mở rộng — UI-S07 Live Race Simulation.
/// Theo live-race-simulation-guide.md:
///   • Animation (vị trí % của ngựa trong lúc Live) là random walk client-side
///     (setInterval 100ms), KHÔNG đồng bộ giữa các client, KHÔNG tính ở BE.
///   • BE chỉ chịu trách nhiệm: (1) trạng thái + actualStartTime để FE biết khi
///     nào bắt đầu chạy animation, (2) kết quả cuối (FinishPosition) để FE biết
///     "về đích" đúng thứ tự khi status chuyển Unofficial, (3) Violation do
///     Referee ghi nhận trong lúc Live (annotation layer độc lập, không ảnh
///     hưởng thuật toán mô phỏng).
///   • Owner/Jockey không báo cáo vi phạm lúc Live; việc ghi nhận vi phạm
///     thuộc về Referee trong quá trình điều hành cuộc đua.
/// </summary>
public class LiveRaceService : ILiveRaceService
{
    private const string StatusPreRace = "Pre-Race";
    private const string StatusLive = "Live";
    private const string StatusUnofficial = "Unofficial";

    private readonly HRTMSDbContext _context;
    private readonly INotificationService _notificationService;

    public LiveRaceService(HRTMSDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    // =====================================================================
    // GET live status — public (mọi role đã đăng nhập đều xem được)
    // =====================================================================
    public async Task<LiveRaceStatusDto> GetLiveStatusAsync(int raceId)
    {
        var race = await _context.Races
            .Include(r => r.RaceEntries).ThenInclude(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(r => r.RaceEntries).ThenInclude(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        var entries = race.RaceEntries
            .Where(e => e.Status != "Cancelled" && !e.IsWithdrawn)
            .OrderBy(e => e.PostPosition ?? int.MaxValue)
            .ThenBy(e => e.RaceEntryId)
            .Select(e => new LiveRaceEntryDto
            {
                RaceEntryId = e.RaceEntryId,
                PostPosition = e.PostPosition,
                Status = e.Status,
                IsWithdrawn = e.IsWithdrawn,
                HorseId = e.Pairing.HorseId,
                HorseName = e.Pairing.Horse.Name,
                JockeyId = e.Pairing.JockeyId,
                JockeyName = e.Pairing.Jockey.Jockey.FullName,
                FinishPosition = e.FinishPosition,
                FinishTime = e.FinishTime
            })
            .ToList();

        return new LiveRaceStatusDto
        {
            RaceId = race.RaceId,
            Status = race.Status,
            ScheduledTime = race.ScheduledTime,
            ActualStartTime = race.ActualStartTime,
            Entries = entries
        };
    }

    // =====================================================================
    // Referee bấm Start Race: Pre-Race -> Live, set ActualStartTime
    // Bat buoc da confirm official starting list (Status == "Pre-Race").
    // Khong cho start truc tiep tu "Upcoming" de tranh bo qua 4 buoc
    // medical/independence check + buoc confirm starting list.
    // =====================================================================
    public async Task<StartRaceResultDto> StartRaceAsync(int raceId, int refereeId)
    {
        var race = await _context.Races
            .Include(r => r.RaceEntries)
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        await EnsureRefereeAssignedAsync(raceId, refereeId);

        if (race.Status != StatusPreRace)
            throw new InvalidOperationException("STARTING_LIST_NOT_CONFIRMED");

        var now = DateTime.UtcNow;

        // EC-17: mọi entry Pending phải được hủy đồng bộ, không phụ thuộc scheduler.
        foreach (var entry in race.RaceEntries.Where(e => e.Status == "Pending" && !e.IsWithdrawn))
        {
            entry.Status = "Cancelled";
            entry.IsWithdrawn = true;
            entry.PostPosition = null;
            entry.WithdrawalReason = "Automatically cancelled when race went live.";
            entry.UpdatedAt = now;
        }

        var eligibleEntries = race.RaceEntries
            .Where(e => e.Status != "Cancelled" && e.Status != "Disqualified" && !e.IsWithdrawn)
            .ToList();

        if (eligibleEntries.Count == 0)
            throw new InvalidOperationException("NO_ELIGIBLE_STARTING_ENTRIES");

        // Re-check tại thời điểm chuyển Live để không dựa hoàn toàn vào bước
        // confirm starting list trước đó.
        if (eligibleEntries.Any(e =>
                e.Status != "Confirmed" ||
                e.PreRaceJockeyWeight == null ||
                e.ClinicalStatus != "Fit" ||
                e.HorseIdentityCheckStatus != "Matched"))
        {
            throw new InvalidOperationException("STARTING_LIST_INVALID");
        }

        race.Status = StatusLive;
        race.ActualStartTime = now;
        race.IsPredictionGateClosed = true;
        race.UpdatedAt = now;

        await _context.SaveChangesAsync();

        return new StartRaceResultDto
        {
            RaceId = race.RaceId,
            Status = race.Status,
            ActualStartTime = race.ActualStartTime!.Value
        };
    }

    // =====================================================================
    // Referee ghi nhận vi phạm trong lúc Live (Module H)
    // =====================================================================
    public async Task<ViolationDto> RecordViolationAsync(int raceId, int refereeId, CreateViolationDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ViolationCode))
            throw new ArgumentException("VIOLATION_CODE_REQUIRED");
        if (!ViolationCodeCatalog.Contains(dto.ViolationCode))
            throw new ArgumentException("INVALID_VIOLATION_CODE");
        if (string.IsNullOrWhiteSpace(dto.Description))
            throw new ArgumentException("DESCRIPTION_REQUIRED");

        var allowedPenalties = new[] { "Disqualified", "PlaceBehind", "Warning", "Scratch" };
        if (!allowedPenalties.Contains(dto.Penalty))
            throw new ArgumentException("INVALID_PENALTY");

        if (dto.Penalty == "PlaceBehind" && dto.PlaceBehindEntryId == null)
            throw new ArgumentException("PLACE_BEHIND_ENTRY_REQUIRED");

        var race = await _context.Races.FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        var referee = await EnsureRefereeAssignedAsync(raceId, refereeId);

        // Chỉ ghi nhận trong lúc Live — đúng nguyên tắc "vi phạm do Referee ghi
        // nhận trong lúc đua". Sau khi race rời Live, không thể thêm vi phạm
        // qua API live này.
        if (race.Status != StatusLive)
            throw new InvalidOperationException("RACE_NOT_LIVE");

        var entry = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == dto.RaceEntryId && e.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");

        if (entry.Status is "Cancelled" or "Disqualified" || entry.IsWithdrawn)
            throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");

        if (dto.PlaceBehindEntryId.HasValue)
        {
            var placeBehindExists = await _context.RaceEntries
                .AnyAsync(e => e.RaceEntryId == dto.PlaceBehindEntryId.Value && e.RaceId == raceId &&
                    e.Status != "Cancelled" && e.Status != "Disqualified" && !e.IsWithdrawn);
            if (!placeBehindExists)
                throw new KeyNotFoundException("PLACE_BEHIND_ENTRY_NOT_FOUND");
        }

        // RaceReport chính thức chỉ được submit khi Live -> Unofficial
        // (SubmitFinishResultsAsync). Trong lúc Live chưa có RaceReport, nên ở
        // đây tìm-hoặc-tạo 1 RaceReport CHƯA KHÓA (IsLocked=false) làm nơi neo
        // (anchor) cho các Violation ghi nhận sớm — khớp UNIQUE(RaceId) đã
        // định nghĩa trong DB. Khi Referee submit kết quả cuối, RaceReport này
        // được tái sử dụng (không tạo trùng).
        var report = await _context.RaceReports.FirstOrDefaultAsync(r => r.RaceId == raceId);
        if (report == null)
        {
            report = new RaceReport
            {
                RaceId = raceId,
                LeadRefereeId = referee.RefereeId,
                IsLocked = false,
                SubmittedAt = DateTime.UtcNow
            };
            _context.RaceReports.Add(report);
            await _context.SaveChangesAsync();
        }
        else if (report.IsLocked)
        {
            throw new InvalidOperationException("RACE_REPORT_LOCKED");
        }

        var violation = new Violation
        {
            RaceReportId = report.RaceReportId,
            RaceEntryId = entry.RaceEntryId,
            ViolationCode = dto.ViolationCode.Trim().ToUpperInvariant(),
            Penalty = dto.Penalty,
            PlaceBehindEntryId = dto.PlaceBehindEntryId,
            Description = dto.Description.Trim(),
            LoggedAt = DateTime.UtcNow
        };
        _context.Violations.Add(violation);
        await _context.SaveChangesAsync();

        return new ViolationDto
        {
            ViolationId = violation.ViolationId,
            RaceEntryId = violation.RaceEntryId,
            HorseName = entry.Pairing.Horse.Name,
            ViolationCode = violation.ViolationCode,
            Penalty = violation.Penalty,
            PlaceBehindEntryId = violation.PlaceBehindEntryId,
            Description = violation.Description,
            LoggedAt = violation.LoggedAt
        };
    }

    // Referee xác nhận ngựa bỏ cuộc trong lúc race đang Live. DNF khác DQ/withdraw:
    // entry đã xuất phát, không được xếp hạng nhưng prediction được settle là Lost.
    public async Task<MarkDnfResultDto> MarkDnfAsync(int raceId, int raceEntryId, int refereeId, MarkDnfDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Trim().Length < 10)
            throw new ArgumentException("DNF_REASON_REQUIRED");

        var race = await _context.Races.FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");
        await EnsureRefereeAssignedAsync(raceId, refereeId);

        if (race.Status != StatusLive)
            throw new InvalidOperationException("RACE_NOT_LIVE");

        var entry = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId && e.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");

        if (entry.Status is "Cancelled" or "Disqualified" || entry.IsWithdrawn)
            throw new InvalidOperationException("RACE_ENTRY_NOT_ELIGIBLE");
        var alreadyDnf = await _context.Violations
            .AnyAsync(v => v.RaceReport.RaceId == raceId && v.RaceEntryId == raceEntryId &&
                           v.ViolationCode == "DNF-001" && v.Penalty == "Scratch");
        if (alreadyDnf)
            throw new InvalidOperationException("RACE_ENTRY_ALREADY_DNF");

        var now = DateTime.UtcNow;
        var report = await _context.RaceReports.FirstOrDefaultAsync(r => r.RaceId == raceId);
        if (report == null)
        {
            report = new RaceReport { RaceId = raceId, LeadRefereeId = refereeId, IsLocked = false, SubmittedAt = now };
            _context.RaceReports.Add(report);
            await _context.SaveChangesAsync();
        }
        else if (report.IsLocked)
            throw new InvalidOperationException("RACE_REPORT_LOCKED");

        _context.Violations.Add(new Violation
        {
            RaceReportId = report.RaceReportId,
            RaceEntryId = raceEntryId,
            ViolationCode = "DNF-001",
            Penalty = "Scratch",
            Description = dto.Reason.Trim(),
            LoggedAt = now
        });
        await _context.SaveChangesAsync();

        var recipients = new HashSet<int> { entry.Pairing.Horse.OwnerId, entry.Pairing.JockeyId };
        var adminIds = await _context.Users.Where(u => u.Role == "Admin" && u.Status == "Active").Select(u => u.UserId).ToListAsync();
        var refereeIds = await _context.RefereeAssignments.Where(a => a.RaceId == raceId).Select(a => a.RefereeId).ToListAsync();
        var doctorIds = await _context.DoctorAssignments.Where(a => a.RaceId == raceId).Select(a => a.DoctorId).ToListAsync();
        recipients.UnionWith(adminIds);
        recipients.UnionWith(refereeIds);
        recipients.UnionWith(doctorIds);
        await _notificationService.SendBulkAsync(recipients,
            "Khẩn: Ngựa bỏ cuộc (DNF)",
            $"Race entry #{raceEntryId} ở cuộc đua #{raceId} đã bỏ cuộc. Lý do: {dto.Reason.Trim()}",
            type: "Both", relatedEntityType: "RaceEntry", relatedEntityId: raceEntryId);

        return new MarkDnfResultDto { RaceEntryId = raceEntryId, RaceId = raceId, DnfReason = dto.Reason.Trim() };
    }

    // =====================================================================
    // GET violations — poll riêng (3-5s), tách khỏi tick animation 100ms
    // =====================================================================
    public async Task<List<ViolationDto>> GetViolationsAsync(int raceId)
    {
        var raceExists = await _context.Races.AnyAsync(r => r.RaceId == raceId);
        if (!raceExists)
            throw new KeyNotFoundException("RACE_NOT_FOUND");

        return await _context.Violations
            .AsNoTracking()
            .Where(v => v.RaceReport.RaceId == raceId)
            .OrderBy(v => v.LoggedAt)
            .Select(v => new ViolationDto
            {
                ViolationId = v.ViolationId,
                RaceEntryId = v.RaceEntryId,
                HorseName = v.RaceEntry.Pairing.Horse.Name,
                ViolationCode = v.ViolationCode,
                Penalty = v.Penalty,
                PlaceBehindEntryId = v.PlaceBehindEntryId,
                Description = v.Description,
                LoggedAt = v.LoggedAt
            })
            .ToListAsync();
    }

    public Task<IReadOnlyList<ViolationCodeOptionDto>> GetViolationCodesAsync() =>
        Task.FromResult(ViolationCodeCatalog.All);

    public async Task<ViolationDto> UpdateViolationAsync(
        int raceId,
        int violationId,
        int refereeId,
        UpdateViolationDto dto)
    {
        ValidateViolationPayload(dto.ViolationCode, dto.Penalty, dto.PlaceBehindEntryId, dto.Description);

        var race = await _context.Races.FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");
        await EnsureRefereeAssignedAsync(raceId, refereeId);
        EnsureViolationsEditable(race);

        var violation = await _context.Violations
            .Include(v => v.RaceEntry).ThenInclude(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(v => v.ViolationId == violationId && v.RaceReport.RaceId == raceId)
            ?? throw new KeyNotFoundException("VIOLATION_NOT_FOUND");

        if (dto.PlaceBehindEntryId.HasValue)
        {
            var placeBehindExists = await _context.RaceEntries
                .AnyAsync(e => e.RaceEntryId == dto.PlaceBehindEntryId.Value && e.RaceId == raceId &&
                    e.Status != "Cancelled" && e.Status != "Disqualified" && !e.IsWithdrawn);
            if (!placeBehindExists)
                throw new KeyNotFoundException("PLACE_BEHIND_ENTRY_NOT_FOUND");
        }

        violation.ViolationCode = dto.ViolationCode.Trim().ToUpperInvariant();
        violation.Penalty = dto.Penalty;
        violation.PlaceBehindEntryId = dto.PlaceBehindEntryId;
        violation.Description = dto.Description.Trim();
        await _context.SaveChangesAsync();

        return ToViolationDto(violation);
    }

    public async Task DeleteViolationAsync(int raceId, int violationId, int refereeId)
    {
        var race = await _context.Races.FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");
        await EnsureRefereeAssignedAsync(raceId, refereeId);
        EnsureViolationsEditable(race);

        var violation = await _context.Violations
            .FirstOrDefaultAsync(v => v.ViolationId == violationId && v.RaceReport.RaceId == raceId)
            ?? throw new KeyNotFoundException("VIOLATION_NOT_FOUND");

        _context.Violations.Remove(violation);
        await _context.SaveChangesAsync();
    }

    // =====================================================================
    // Referee chốt sơ bộ FinishPosition, chuyển Live -> Unofficial
    // =====================================================================
    public async Task<SubmitFinishResultsResultDto> SubmitFinishResultsAsync(int raceId, int refereeId, SubmitFinishResultsDto dto)
    {
        if (dto.Results == null || dto.Results.Count == 0)
            throw new ArgumentException("RESULTS_REQUIRED");

        var race = await _context.Races
            .Include(r => r.RaceEntries)
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        var referee = await EnsureRefereeAssignedAsync(raceId, refereeId);

        if (race.Status != StatusLive)
            throw new InvalidOperationException("RACE_NOT_LIVE");

        // Disqualified đã bị loại khỏi cuộc đua — không cần FinishPosition lẫn
        // cân sau đua, khớp với quy tắc DeclareOfficialAsync (IsRankingIntegrityValid /
        // IsPostRaceWeighInComplete) vốn cũng loại trừ Disqualified.
        var dnfEntryIds = await _context.Violations
            .Where(v => v.RaceReport.RaceId == raceId && v.ViolationCode == "DNF-001" && v.Penalty == "Scratch")
            .Select(v => v.RaceEntryId)
            .ToListAsync();

        var eligibleEntryIds = race.RaceEntries
            .Where(e => e.Status != "Cancelled" && e.Status != "Disqualified" && !e.IsWithdrawn)
            .Where(e => !dnfEntryIds.Contains(e.RaceEntryId))
            .Select(e => e.RaceEntryId)
            .ToHashSet();

        var submittedIds = dto.Results.Select(r => r.RaceEntryId).ToList();
        if (submittedIds.Distinct().Count() != submittedIds.Count)
            throw new ArgumentException("DUPLICATE_RACE_ENTRY_IN_RESULTS");

        if (submittedIds.Count != eligibleEntryIds.Count || !eligibleEntryIds.SetEquals(submittedIds))
            throw new ArgumentException("RESULTS_MUST_INCLUDE_ALL_ELIGIBLE_ENTRIES");

        if (race.RaceEntries
            .Where(e => eligibleEntryIds.Contains(e.RaceEntryId))
            .Any(e => e.PostRaceJockeyWeight == null))
        {
            throw new InvalidOperationException("POST_RACE_WEIGH_IN_INCOMPLETE");
        }

        foreach (var r in dto.Results)
        {
            if (!eligibleEntryIds.Contains(r.RaceEntryId))
                throw new KeyNotFoundException("RACE_ENTRY_NOT_FOUND");
            if (r.FinishPosition <= 0)
                throw new ArgumentException("INVALID_FINISH_POSITION");
        }

        ValidateStandardCompetitionRanking(dto.Results.Select(r => r.FinishPosition));

        using var transaction = await _context.Database.BeginTransactionAsync();

        var now = DateTime.UtcNow;

        foreach (var r in dto.Results)
        {
            var entry = race.RaceEntries.First(e => e.RaceEntryId == r.RaceEntryId);
            entry.FinishPosition = r.FinishPosition;
            entry.FinishTime = r.FinishTime;
            entry.UpdatedAt = now;
        }

        // Tái sử dụng RaceReport đã tạo lúc ghi violation trong Live (nếu có),
        // tránh vi phạm UNIQUE(RaceId) trên RaceReports.
        var report = await _context.RaceReports.FirstOrDefaultAsync(rr => rr.RaceId == raceId);
        if (report == null)
        {
            report = new RaceReport
            {
                RaceId = raceId,
                LeadRefereeId = referee.RefereeId,
                IsLocked = false,
                SubmittedAt = now
            };
            _context.RaceReports.Add(report);
        }
        else if (report.IsLocked)
        {
            throw new InvalidOperationException("RACE_REPORT_LOCKED");
        }
        else
        {
            report.LeadRefereeId = referee.RefereeId;
            report.SubmittedAt = now;
        }

        if (!string.IsNullOrWhiteSpace(dto.Notes))
            report.Notes = dto.Notes;

        race.Status = StatusUnofficial;
        race.UpdatedAt = now;

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();

        return new SubmitFinishResultsResultDto
        {
            RaceId = race.RaceId,
            Status = race.Status,
            RaceReportId = report.RaceReportId
        };
    }

    // =====================================================================
    // Helpers
    // =====================================================================
    private async Task<RefereeProfile> EnsureRefereeAssignedAsync(int raceId, int refereeId)
    {
        var referee = await _context.RefereeProfiles
            .FirstOrDefaultAsync(r => r.RefereeId == refereeId)
            ?? throw new KeyNotFoundException("REFEREE_NOT_FOUND");

        var assigned = await _context.RefereeAssignments
            .AnyAsync(a => a.RaceId == raceId && a.RefereeId == refereeId);
        if (!assigned)
            throw new InvalidOperationException("REFEREE_NOT_ASSIGNED_TO_RACE");

        return referee;
    }

    private static void ValidateViolationPayload(string violationCode, string penalty, int? placeBehindEntryId, string description)
    {
        if (string.IsNullOrWhiteSpace(violationCode))
            throw new ArgumentException("VIOLATION_CODE_REQUIRED");
        if (!ViolationCodeCatalog.Contains(violationCode))
            throw new ArgumentException("INVALID_VIOLATION_CODE");
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("DESCRIPTION_REQUIRED");

        var allowedPenalties = new[] { "Disqualified", "PlaceBehind", "Warning", "Scratch" };
        if (!allowedPenalties.Contains(penalty))
            throw new ArgumentException("INVALID_PENALTY");
        if (penalty == "PlaceBehind" && placeBehindEntryId == null)
            throw new ArgumentException("PLACE_BEHIND_ENTRY_REQUIRED");
    }

    private static void EnsureViolationsEditable(Race race)
    {
        if (race.Status != StatusLive)
            throw new InvalidOperationException("RACE_NOT_LIVE");
    }

    private static ViolationDto ToViolationDto(Violation violation) => new()
    {
        ViolationId = violation.ViolationId,
        RaceEntryId = violation.RaceEntryId,
        HorseName = violation.RaceEntry.Pairing.Horse.Name,
        ViolationCode = violation.ViolationCode,
        Penalty = violation.Penalty,
        PlaceBehindEntryId = violation.PlaceBehindEntryId,
        Description = violation.Description,
        LoggedAt = violation.LoggedAt
    };

    private static void ValidateStandardCompetitionRanking(IEnumerable<int> positions)
    {
        var expectedPosition = 1;
        foreach (var group in positions.GroupBy(position => position).OrderBy(group => group.Key))
        {
            if (group.Key != expectedPosition)
                throw new ArgumentException("INVALID_STANDARD_RANKING");
            expectedPosition += group.Count();
        }
    }
}
