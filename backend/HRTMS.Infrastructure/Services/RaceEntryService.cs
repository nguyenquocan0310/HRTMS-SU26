using HRTMS.Core.DTOs.RaceEntry;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

// Module E — Lập lịch, Bốc thăm & Rút lui.
// Theo convention HRTMS: service dùng HRTMSDbContext trực tiếp, ném exception với
// "error code" là message để Controller map sang HTTP status.
public class RaceEntryService : IRaceEntryService
{
    // Cac trang thai entry duoc tinh la "hop le" (chiem 1 suat trong Race / 1 cong).
    private static readonly string[] ActiveEntryStatuses = { "Pending", "Confirmed" };

    private readonly HRTMSDbContext _context;
    private readonly INotificationService _notification;
    private readonly IAuditLogService _audit;

    public RaceEntryService(
        HRTMSDbContext context,
        INotificationService notification,
        IAuditLogService audit)
    {
        _context = context;
        _notification = notification;
        _audit = audit;
    }

    // =====================================================================
    // Phân bổ Pairing vào Race
    // =====================================================================
    public async Task<RaceEntryResponseDto> AllocateAsync(
        int adminId, int raceId, AllocateEntryDto dto)
    {
        // Load Race kem Round -> Tournament de validate cua so thoi gian & MaxHorses.
        var race = await _context.Races
            .Include(r => r.Round)
                .ThenInclude(rd => rd.Tournament)
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        // Đã bốc thăm rồi thì không thêm entry được nữa (danh sách xuất phát đã chốt).
        if (race.IsPostPositionDrawn)
            throw new InvalidOperationException("RACE_ALREADY_DRAWN");

        // Chi cho phan bo khi Race con Upcoming.
        if (race.Status != "Upcoming")
            throw new InvalidOperationException("INVALID_RACE_STATE");

        // Chi xep lich khi giai o Open/Closed Registration — chan Draft (cau truc
        // chua chot) va Completed/Cancelled (giai da ket thuc).
        EnsureTournamentOpenForScheduling(race.Round.Tournament.Status);

        // Cửa sổ thời gian phải còn hợp lệ.
        ValidateScheduleWindow(race);

        // Load Pairing kem Horse + Jockey(User) de kiem dieu kien va de tra ve ten.
        var pairing = await _context.Pairings
            .Include(p => p.Horse)
            .Include(p => p.Jockey).ThenInclude(j => j.Jockey)
            .FirstOrDefaultAsync(p => p.PairingId == dto.PairingId)
            ?? throw new KeyNotFoundException("PAIRING_NOT_FOUND");

        // Pairing chi co gia tri trong pham vi giai cua no — chan allocate cheo giai.
        if (pairing.TournamentId != race.Round.TournamentId)
            throw new InvalidOperationException("PAIRING_TOURNAMENT_MISMATCH");

        // Chỉ cặp đã Confirmed (jockey accept + owner confirm) mới được đưa vào đua.
        // "Accepted" mới chỉ là jockey đồng ý, owner chưa confirm -> chưa đủ điều kiện.
        if (pairing.Status != "Confirmed")
            throw new InvalidOperationException("PAIRING_NOT_CONFIRMED");

        // Một pairing chỉ có một RaceEntry còn hiệu lực trong mỗi round. Guard này
        // phải tồn tại ở API (không chỉ ở candidate picker) để chặn gọi trực tiếp
        // đưa cùng pairing vào race khác của cùng vòng.
        var alreadyAllocatedInRound = await _context.RaceEntries.AnyAsync(e =>
            e.PairingId == pairing.PairingId &&
            e.Race.RoundId == race.RoundId &&
            e.Status != "Cancelled");
        if (alreadyAllocatedInRound)
            throw new InvalidOperationException("PAIRING_ALREADY_ALLOCATED_IN_ROUND");

        // Progression: round dau allocate tu do tu confirmed pairings; tu round 2 tro di
        // chi pairing da Qualified/AlsoEligible o round TRUOC (round truoc phai Completed).
        var previousRound = await _context.Rounds
            .Where(r => r.TournamentId == race.Round.TournamentId &&
                        r.SequenceOrder < race.Round.SequenceOrder)
            .OrderByDescending(r => r.SequenceOrder)
            .FirstOrDefaultAsync();
        if (previousRound != null)
        {
            if (previousRound.Status != "Completed")
                throw new InvalidOperationException("PREVIOUS_ROUND_NOT_COMPLETED");

            var isEligible = await _context.RaceEntries.AnyAsync(e =>
                e.PairingId == pairing.PairingId &&
                e.Race.RoundId == previousRound.RoundId &&
                (e.AdvancementStatus == "Qualified" || e.AdvancementStatus == "AlsoEligible"));
            if (!isEligible)
                throw new InvalidOperationException("PAIRING_NOT_QUALIFIED");
        }

        // Schema v3: ngua duoc duyet theo TUNG giai (HorseTournamentEntries), khong dung
        // cot approval global tren Horse — enrollment co the bi Admin reject SAU khi
        // pairing da Confirmed.
        var enrollmentApproved = await _context.HorseTournamentEntries.AnyAsync(e =>
            e.HorseId == pairing.HorseId &&
            e.TournamentId == race.Round.TournamentId &&
            e.Status == "Enrolled" &&
            e.AdminApprovalStatus == "Approved");
        if (!enrollmentApproved)
            throw new InvalidOperationException("HORSE_NOT_APPROVED_IN_TOURNAMENT");

        // Tái kiểm tra kinh nghiệm Jockey tại thời điểm đưa cặp vào Race cụ thể,
        // vì ngưỡng MinJockeyExperienceYears phụ thuộc từng giải.
        if (pairing.Jockey.ExperienceYears < race.Round.Tournament.MinJockeyExperienceYears)
            throw new InvalidOperationException("JOCKEY_EXPERIENCE_TOO_LOW");

        // Chặn khi số entry hợp lệ đã đạt MaxHorses (không áp số tối thiểu).
        var currentCount = await _context.RaceEntries
            .CountAsync(e => e.RaceId == raceId && ActiveEntryStatuses.Contains(e.Status));
        if (currentCount >= race.Round.Tournament.MaxHorses)
            throw new InvalidOperationException("MAX_HORSES_REACHED");

        // Chặn cùng HorseId hoặc JockeyId xuất hiện 2 lần trong CÙNG một Race.
        var duplicateInRace = await _context.RaceEntries
            .Include(e => e.Pairing)
            .AnyAsync(e =>
                e.RaceId == raceId &&
                ActiveEntryStatuses.Contains(e.Status) &&
                (e.Pairing.HorseId == pairing.HorseId ||
                 e.Pairing.JockeyId == pairing.JockeyId));
        if (duplicateInRace)
            throw new InvalidOperationException("DUPLICATE_IN_RACE");

        // Chặn double-booking: cùng Horse/Jockey ở Race khác cùng giờ chạy.
        // Pha 1 định nghĩa "chồng lấp" = trùng ScheduledTime (chưa có trường thời lượng đua).
        var doubleBooked = await _context.RaceEntries
            .Include(e => e.Pairing)
            .Include(e => e.Race)
            .AnyAsync(e =>
                e.RaceId != raceId &&
                ActiveEntryStatuses.Contains(e.Status) &&
                e.Race.ScheduledTime == race.ScheduledTime &&
                (e.Pairing.HorseId == pairing.HorseId ||
                 e.Pairing.JockeyId == pairing.JockeyId));
        if (doubleBooked)
            throw new InvalidOperationException("DOUBLE_BOOKED");

        var now = DateTime.UtcNow;
        // Giai mien phi (EntryFeeAmount == 0) -> tu dong Paid; nguoc lai Unpaid cho Admin xac nhan sau.
        var feeStatus = race.Round.Tournament.EntryFeeAmount == 0 ? "Paid" : "Unpaid";
        var entry = new RaceEntry
        {
            RaceId = raceId,
            PairingId = dto.PairingId,
            Status = "Pending",
            EntryFeeStatus = feeStatus,
            IsWithdrawn = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.RaceEntries.Add(entry);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (
            ex.InnerException is SqlException sqlEx &&
            (sqlEx.Number == 2601 || sqlEx.Number == 2627))
        {
            // CHI map khi that su vi pham UNIQUE (2601/2627) — vd UQ_RaceEntries_RacePairing.
            // Cac loi DB khac (CHECK, FK, NOT NULL...) duoc nem tiep de lo nguyen nhan that.
            throw new InvalidOperationException("DUPLICATE_IN_RACE");
        }

        await _audit.LogAsync(adminId, "Xếp ngựa vào cuộc đua", "RaceEntry",
            entry.RaceEntryId.ToString(), null,
            $"RaceId={raceId};PairingId={dto.PairingId}");

        // Bao Owner: ngua da duoc xep vao cuoc dua, can xac nhan tham gia truoc cut-off (email + in-app).
        await _notification.SendAsync(
            pairing.Horse.OwnerId,
            "Ngựa đã được xếp vào cuộc đua",
            $"Ngựa '{pairing.Horse.Name}' đã được xếp vào cuộc đua #{raceId}. Vui lòng xác nhận tham gia trước hạn chốt.",
            type: "Both",
            relatedEntityType: "RaceEntry",
            relatedEntityId: entry.RaceEntryId);

        return MapToResponse(entry, pairing);
    }

    // =====================================================================
    // Tự động phân bổ cả vòng (Module E — thay cho việc click từng pairing)
    // =====================================================================
    // Round 1 : pairing Confirmed + lệ phí Verified, ưu tiên verify sớm hơn.
    // Round 2+: entry Qualified/AlsoEligible ở vòng TRƯỚC (không quét lại toàn giải,
    //           nên pairing đã đua vòng loại không bị "biến mất" ở vòng sau).
    // Sức chứa mỗi race = min(Tournament.MaxHorses, Venue.LaneCount).
    public async Task<AutoAllocateResultDto> AutoAllocateRoundAsync(int actorId, int roundId)
    {
        var round = await _context.Rounds
            .Include(r => r.Tournament).ThenInclude(t => t.Venue)
            .Include(r => r.Races)
            .FirstOrDefaultAsync(r => r.RoundId == roundId)
            ?? throw new KeyNotFoundException("ROUND_NOT_FOUND");

        var tournament = round.Tournament;

        EnsureTournamentOpenForScheduling(tournament.Status);

        // Sức chứa lấy từ số làn của sân — không có sân thì không biết trần cứng.
        if (tournament.Venue == null)
            throw new InvalidOperationException("VENUE_REQUIRED");

        var races = round.Races
            .Where(r => r.Status != "Cancelled")
            .OrderBy(r => r.RaceNumber)
            .ToList();

        if (races.Count == 0)
            throw new InvalidOperationException("NO_RACES_IN_ROUND");

        // Đã bốc thăm thì danh sách xuất phát đã chốt — không phân bổ lại.
        if (races.Any(r => r.IsPostPositionDrawn))
            throw new InvalidOperationException("ROUND_ALREADY_DRAWN");

        // Idempotency: vòng đã có entry hợp lệ nghĩa là đã allocate.
        var raceIds = races.Select(r => r.RaceId).ToList();
        var hasEntries = await _context.RaceEntries
            .AnyAsync(e => raceIds.Contains(e.RaceId) && ActiveEntryStatuses.Contains(e.Status));
        if (hasEntries)
            throw new InvalidOperationException("ROUND_ALREADY_ALLOCATED");

        var previousRound = await _context.Rounds
            .Where(r => r.TournamentId == round.TournamentId &&
                        r.SequenceOrder < round.SequenceOrder)
            .OrderByDescending(r => r.SequenceOrder)
            .FirstOrDefaultAsync();

        if (previousRound != null && previousRound.Status != "Completed")
            throw new InvalidOperationException("PREVIOUS_ROUND_NOT_COMPLETED");

        var pool = previousRound == null
            ? await BuildFirstRoundPoolAsync(round.TournamentId)
            : await BuildProgressionPoolAsync(round.TournamentId, previousRound.RoundId);

        if (pool.Count == 0)
            throw new InvalidOperationException("NO_ELIGIBLE_PAIRINGS");

        var capacityPerRace = Math.Min(tournament.MaxHorses, tournament.Venue.LaneCount);
        var totalCapacity = capacityPerRace * races.Count;

        // Pool vượt sức chứa: giữ theo thứ tự ưu tiên đã sắp (fee verified sớm hơn
        // ở vòng 1; Qualified trước AlsoEligible ở vòng sau), phần dư thành waitlist.
        var selected = pool.Take(totalCapacity).ToList();
        var waitlisted = pool.Skip(totalCapacity).ToList();

        // Xáo trộn Fisher-Yates để thứ tự nộp phí KHÔNG quyết định vào race nào —
        // ưu tiên chỉ dùng để chọn AI được vào, không dùng để chọn VÀO ĐÂU.
        var rng = Random.Shared;
        for (int i = selected.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (selected[i], selected[j]) = (selected[j], selected[i]);
        }

        var now = DateTime.UtcNow;
        var created = new List<(RaceEntry Entry, PoolCandidate Candidate, Race Race)>();

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // Chia round-robin -> các race lệch nhau tối đa 1 ngựa.
            for (int i = 0; i < selected.Count; i++)
            {
                var race = races[i % races.Count];
                var candidate = selected[i];

                var entry = new RaceEntry
                {
                    RaceId = race.RaceId,
                    PairingId = candidate.PairingId,
                    // Auto-allocate chỉ nhận pairing đã Confirmed + phí Verified nên
                    // entry vào thẳng Confirmed: không còn bước Owner tự xác nhận.
                    Status = "Confirmed",
                    EntryFeeStatus = "Paid",
                    IsWithdrawn = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                _context.RaceEntries.Add(entry);
                created.Add((entry, candidate, race));
            }

            await _context.SaveChangesAsync();

            await _audit.LogAsync(actorId, "Tự động phân ngựa vào cuộc đua", "Round",
                roundId.ToString(), null,
                $"Allocated={created.Count};Waitlisted={waitlisted.Count};" +
                $"Capacity={capacityPerRace}/race;Races={races.Count}");

            await tx.CommitAsync();
        }
        catch (DbUpdateException ex) when (
            ex.InnerException is SqlException sqlEx &&
            (sqlEx.Number == 2601 || sqlEx.Number == 2627))
        {
            await tx.RollbackAsync();
            // Một tiến trình khác (job hoặc Admin thứ hai) đã allocate trước.
            throw new InvalidOperationException("ROUND_ALREADY_ALLOCATED");
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        // Notification sau khi commit — thất bại gửi tin không được rollback phân bổ.
        foreach (var (entry, candidate, race) in created)
        {
            await _notification.SendAsync(
                candidate.OwnerId,
                "Ngựa đã được phân vào cuộc đua",
                $"Ngựa '{candidate.HorseName}' đã được phân vào Cuộc đua #{race.RaceNumber}, " +
                $"lúc {race.ScheduledTime:dd/MM/yyyy HH:mm} (giờ UTC).",
                type: "Both",
                relatedEntityType: "RaceEntry",
                relatedEntityId: entry.RaceEntryId);
        }

        return new AutoAllocateResultDto
        {
            RoundId = roundId,
            TournamentId = round.TournamentId,
            PoolSize = pool.Count,
            CapacityPerRace = capacityPerRace,
            RaceCount = races.Count,
            TotalCapacity = totalCapacity,
            AllocatedCount = created.Count,
            WaitlistedCount = waitlisted.Count,
            Races = races.Select(r => new AutoAllocateRaceDto
            {
                RaceId = r.RaceId,
                RaceNumber = r.RaceNumber,
                ScheduledTime = r.ScheduledTime,
                EntryCount = created.Count(c => c.Race.RaceId == r.RaceId),
                Entries = created
                    .Where(c => c.Race.RaceId == r.RaceId)
                    .Select(c => new AutoAllocateEntryDto
                    {
                        RaceEntryId = c.Entry.RaceEntryId,
                        PairingId = c.Candidate.PairingId,
                        HorseId = c.Candidate.HorseId,
                        HorseName = c.Candidate.HorseName,
                        JockeyId = c.Candidate.JockeyId,
                        JockeyName = c.Candidate.JockeyName
                    }).ToList()
            }).ToList(),
            Waitlist = waitlisted.Select(c => new AutoAllocateWaitlistDto
            {
                PairingId = c.PairingId,
                HorseId = c.HorseId,
                HorseName = c.HorseName,
                FeeVerifiedAt = c.FeeVerifiedAt
            }).ToList()
        };
    }

    // Ứng viên trong pool phân bổ.
    private sealed record PoolCandidate(
        int PairingId, int HorseId, string HorseName,
        int JockeyId, string JockeyName, int OwnerId, DateTime? FeeVerifiedAt);

    // Vòng 1: pairing Confirmed + lệ phí Verified + ngựa còn được duyệt trong giải.
    // Ưu tiên fee verified sớm hơn khi pool vượt sức chứa.
    private async Task<List<PoolCandidate>> BuildFirstRoundPoolAsync(int tournamentId)
    {
        var rows = await _context.Pairings
            .Where(p => p.TournamentId == tournamentId && p.Status == "Confirmed")
            .Select(p => new
            {
                p.PairingId,
                p.HorseId,
                HorseName = p.Horse.Name,
                p.JockeyId,
                JockeyName = p.Jockey.Jockey.FullName,
                p.Horse.OwnerId,
                // Bất biến "Confirmed <=> có payment Verified" do
                // EntryFeePaymentService giữ; ở đây kiểm tra lại để pairing
                // Confirmed bằng đường khác cũng không lọt vào pool.
                FeeVerifiedAt = _context.EntryFeePayments
                    .Where(f => f.PairingId == p.PairingId && f.Status == "Verified")
                    .Select(f => (DateTime?)f.VerifiedAt)
                    .FirstOrDefault(),
                EnrollmentApproved = _context.HorseTournamentEntries
                    .Any(e => e.HorseId == p.HorseId &&
                              e.TournamentId == tournamentId &&
                              e.Status == "Enrolled" &&
                              e.AdminApprovalStatus == "Approved")
            })
            .ToListAsync();

        return rows
            .Where(r => r.FeeVerifiedAt != null && r.EnrollmentApproved)
            // Nộp/verify sớm hơn được ưu tiên khi phải cắt theo sức chứa.
            .OrderBy(r => r.FeeVerifiedAt)
            .ThenBy(r => r.PairingId)
            .Select(r => new PoolCandidate(
                r.PairingId, r.HorseId, r.HorseName,
                r.JockeyId, r.JockeyName, r.OwnerId, r.FeeVerifiedAt))
            .ToList();
    }

    // Vòng 2+: CHỈ entry Qualified/AlsoEligible của vòng TRƯỚC.
    // Qualified xếp trước AlsoEligible (AlsoEligible là danh sách dự bị), trong mỗi
    // nhóm xếp theo AdvancementRank.
    private async Task<List<PoolCandidate>> BuildProgressionPoolAsync(
        int tournamentId, int previousRoundId)
    {
        var rows = await _context.RaceEntries
            .Where(e => e.Race.RoundId == previousRoundId &&
                        (e.AdvancementStatus == "Qualified" || e.AdvancementStatus == "AlsoEligible"))
            .Select(e => new
            {
                e.PairingId,
                e.Pairing.HorseId,
                HorseName = e.Pairing.Horse.Name,
                e.Pairing.JockeyId,
                JockeyName = e.Pairing.Jockey.Jockey.FullName,
                e.Pairing.Horse.OwnerId,
                e.AdvancementStatus,
                e.AdvancementRank,
                PairingStatus = e.Pairing.Status,
                EnrollmentApproved = _context.HorseTournamentEntries
                    .Any(h => h.HorseId == e.Pairing.HorseId &&
                              h.TournamentId == tournamentId &&
                              h.Status == "Enrolled" &&
                              h.AdminApprovalStatus == "Approved")
            })
            .ToListAsync();

        return rows
            // Pairing có thể bị hủy giữa chừng (ngựa rút khỏi giải) — không cho đi tiếp.
            .Where(r => r.PairingStatus == "Confirmed" && r.EnrollmentApproved)
            .GroupBy(r => r.PairingId)
            .Select(g => g.First())
            .OrderBy(r => r.AdvancementStatus == "Qualified" ? 0 : 1)
            .ThenBy(r => r.AdvancementRank ?? int.MaxValue)
            .ThenBy(r => r.PairingId)
            .Select(r => new PoolCandidate(
                r.PairingId, r.HorseId, r.HorseName,
                r.JockeyId, r.JockeyName, r.OwnerId, null))
            .ToList();
    }

    // =====================================================================
    // Manual override: chuyển entry sang race khác cùng vòng
    // =====================================================================
    public async Task<RaceEntryResponseDto> MoveEntryAsync(
        int adminId, int raceEntryId, int targetRaceId)
    {
        var entry = await _context.RaceEntries
            .Include(e => e.Race).ThenInclude(r => r.Round).ThenInclude(rd => rd.Tournament)
                .ThenInclude(t => t.Venue)
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId)
            ?? throw new KeyNotFoundException("ENTRY_NOT_FOUND");

        if (!ActiveEntryStatuses.Contains(entry.Status))
            throw new InvalidOperationException("INVALID_STATUS");

        var targetRace = await _context.Races
            .Include(r => r.Round).ThenInclude(rd => rd.Tournament).ThenInclude(t => t.Venue)
            .FirstOrDefaultAsync(r => r.RaceId == targetRaceId)
            ?? throw new KeyNotFoundException("TARGET_RACE_NOT_FOUND");

        if (targetRace.RaceId == entry.RaceId)
            throw new InvalidOperationException("SAME_RACE");

        // Chỉ đổi trong CÙNG vòng — chuyển sang vòng khác sẽ phá guard progression
        // (và cũng chặn luôn move cross-tournament).
        if (targetRace.RoundId != entry.Race.RoundId)
            throw new InvalidOperationException("RACE_NOT_IN_SAME_ROUND");

        // Cả hai phía đều phải chưa bốc thăm: race nguồn đã bốc thì cổng đã công bố.
        if (entry.Race.IsPostPositionDrawn || targetRace.IsPostPositionDrawn)
            throw new InvalidOperationException("ALREADY_DRAWN");

        if (targetRace.Status != "Upcoming")
            throw new InvalidOperationException("INVALID_RACE_STATE");

        EnsureTournamentOpenForScheduling(targetRace.Round.Tournament.Status);

        // Manual move không được là đường vòng để đưa pairing chưa trả phí vào đua.
        var feeVerified = await _context.EntryFeePayments
            .AnyAsync(p => p.PairingId == entry.PairingId && p.Status == "Verified");
        if (!feeVerified)
            throw new InvalidOperationException("PAIRING_FEE_NOT_PAID");

        var venue = targetRace.Round.Tournament.Venue;
        var capacity = venue == null
            ? targetRace.Round.Tournament.MaxHorses
            : Math.Min(targetRace.Round.Tournament.MaxHorses, venue.LaneCount);

        var targetCount = await _context.RaceEntries
            .CountAsync(e => e.RaceId == targetRaceId && ActiveEntryStatuses.Contains(e.Status));
        if (targetCount >= capacity)
            throw new InvalidOperationException("MAX_LANES_REACHED");

        var duplicate = await _context.RaceEntries
            .AnyAsync(e => e.RaceId == targetRaceId &&
                           ActiveEntryStatuses.Contains(e.Status) &&
                           (e.Pairing.HorseId == entry.Pairing.HorseId ||
                            e.Pairing.JockeyId == entry.Pairing.JockeyId));
        if (duplicate)
            throw new InvalidOperationException("DUPLICATE_IN_RACE");

        var sourceRaceId = entry.RaceId;
        entry.RaceId = targetRaceId;
        // Chưa bốc thăm nên PostPosition phải rỗng; set lại cho chắc.
        entry.PostPosition = null;
        entry.UpdatedAt = DateTime.UtcNow;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (
            ex.InnerException is SqlException sqlEx &&
            (sqlEx.Number == 2601 || sqlEx.Number == 2627))
        {
            throw new InvalidOperationException("DUPLICATE_IN_RACE");
        }

        await _audit.LogAsync(adminId, "Chuyển ngựa sang cuộc đua khác", "RaceEntry",
            raceEntryId.ToString(), $"RaceId={sourceRaceId}", $"RaceId={targetRaceId}");

        await _notification.SendAsync(
            entry.Pairing.Horse.OwnerId,
            "Ngựa được chuyển cuộc đua",
            $"Ngựa '{entry.Pairing.Horse.Name}' đã được chuyển sang Cuộc đua #{targetRace.RaceNumber}, " +
            $"lúc {targetRace.ScheduledTime:dd/MM/yyyy HH:mm} (giờ UTC).",
            type: "Both",
            relatedEntityType: "RaceEntry",
            relatedEntityId: raceEntryId);

        return MapToResponse(entry, entry.Pairing);
    }

    // =====================================================================
    // Job nén: auto-allocate vòng 1 của giải đã quá hạn nộp phí
    // =====================================================================
    public async Task<int> AutoAllocateDueRoundsAsync()
    {
        var now = DateTime.UtcNow;

        // Chỉ vòng ĐẦU (SequenceOrder nhỏ nhất) của giải đã quá PaymentDeadline.
        // Vòng N+1 được kích hoạt sau khi vòng N Completed (ApplyProgressionAsync),
        // không phải bởi job này.
        var candidateRoundIds = await _context.Rounds
            .Where(r => r.Tournament.PaymentDeadline != null &&
                        r.Tournament.PaymentDeadline < now &&
                        (r.Tournament.Status == "Open Registration" ||
                         r.Tournament.Status == "Closed Registration") &&
                        r.Status == "Upcoming" &&
                        r.SequenceOrder == _context.Rounds
                            .Where(x => x.TournamentId == r.TournamentId)
                            .Min(x => x.SequenceOrder))
            .Select(r => r.RoundId)
            .ToListAsync();

        if (candidateRoundIds.Count == 0)
            return 0;

        var systemActorId = await _context.Users
            .Where(u => u.Role == "System" && u.Status == "Active")
            .Select(u => u.UserId)
            .FirstOrDefaultAsync();
        if (systemActorId == 0)
            throw new InvalidOperationException("SYSTEM_USER_NOT_FOUND");

        var allocated = 0;
        foreach (var roundId in candidateRoundIds)
        {
            try
            {
                await AutoAllocateRoundAsync(systemActorId, roundId);
                allocated++;
            }
            catch (InvalidOperationException)
            {
                // Đã allocate / đã bốc thăm / chưa có pairing đủ điều kiện / thiếu
                // sân — đều là trạng thái hợp lệ để BỎ QUA. Nhờ vậy job chạy lại
                // mỗi giờ không tạo entry trùng và không làm hỏng vòng khác.
                continue;
            }
        }

        return allocated;
    }

    // =====================================================================
    // Bốc thăm vị trí xuất phát (NGUYÊN TỬ)
    // =====================================================================
    public async Task<PostPositionDrawResultDto> DrawPostPositionsAsync(int adminId, int raceId)
    {
        var race = await _context.Races
            .Include(r => r.Round).ThenInclude(rd => rd.Tournament)
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        // Khong boc tham 2 lan (idempotent-guard, tranh xao tron lai cong da cong khai).
        if (race.IsPostPositionDrawn)
            throw new InvalidOperationException("ALREADY_DRAWN");

        // Cung guard voi AllocateAsync: giai phai o Open/Closed Registration.
        EnsureTournamentOpenForScheduling(race.Round.Tournament.Status);

        // Chi boc cho cac entry hop le (Pending/Confirmed), bo qua Cancelled.
        var entries = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Where(e => e.RaceId == raceId && ActiveEntryStatuses.Contains(e.Status))
            .ToListAsync();

        if (entries.Count == 0)
            throw new InvalidOperationException("NO_ELIGIBLE_ENTRIES");

        // Xao tron Fisher-Yates trong bo nho (deterministic, kiem soat duoc — KHONG order by Guid tren DB).
        var rng = Random.Shared;
        for (int i = entries.Count - 1; i > 0; i--)
        {
            int j = rng.Next(i + 1);
            (entries[i], entries[j]) = (entries[j], entries[i]);
        }

        // Gan toan bo trong MOT transaction; UNIQUE(RaceId, PostPosition) bao dam khong trung cong.
        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var now = DateTime.UtcNow;
            for (int pos = 0; pos < entries.Count; pos++)
            {
                entries[pos].PostPosition = pos + 1;
                entries[pos].UpdatedAt = now;
            }

            race.IsPostPositionDrawn = true;
            race.UpdatedAt = now;

            await _context.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch (DbUpdateException)
        {
            await tx.RollbackAsync();
            // Hai phien boc tham song song -> vi pham UNIQUE -> bao xung dot.
            throw new InvalidOperationException("DRAW_CONFLICT");
        }

        await _audit.LogAsync(adminId, "Bốc thăm vị trí xuất phát", "Race",
            raceId.ToString(), null, $"Entries={entries.Count}");

        // Bao Owner cong xuat phat cua tung ngua (sau khi da commit boc tham).
        foreach (var e in entries)
        {
            await _notification.SendAsync(
                e.Pairing.Horse.OwnerId,
                "Đã bốc thăm vị trí xuất phát",
                $"Ngựa '{e.Pairing.Horse.Name}' nhận cổng xuất phát số {e.PostPosition} ở cuộc đua #{raceId}.",
                relatedEntityType: "Race",
                relatedEntityId: raceId);
        }

        return new PostPositionDrawResultDto
        {
            RaceId = raceId,
            IsPostPositionDrawn = true,
            TotalEntries = entries.Count,
            Assignments = entries
                .OrderBy(e => e.PostPosition)
                .Select(e => new PostPositionAssignmentDto
                {
                    RaceEntryId = e.RaceEntryId,
                    PairingId = e.PairingId,
                    HorseId = e.Pairing.HorseId,
                    HorseName = e.Pairing.Horse.Name,
                    PostPosition = e.PostPosition!.Value
                })
                .ToList()
        };
    }

    // =====================================================================
    // Lịch thi đấu công khai
    // =====================================================================
    public async Task<RaceScheduleDto> GetRaceScheduleAsync(int raceId)
    {
        var race = await _context.Races
            .Include(r => r.Round).ThenInclude(rd => rd.Tournament).ThenInclude(t => t.Venue)
            .Include(r => r.RaceEntries).ThenInclude(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(r => r.RaceEntries).ThenInclude(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        var venue = race.Round.Tournament.Venue;

        return new RaceScheduleDto
        {
            RaceId = race.RaceId,
            RoundId = race.RoundId,
            RaceNumber = race.RaceNumber,
            ScheduledTime = race.ScheduledTime,
            Status = race.Status,
            IsPostPositionDrawn = race.IsPostPositionDrawn,
            ConfirmationCutoffHours = race.ConfirmationCutoffHours,
            ConfirmationCutoffTime = race.ScheduledTime.AddHours(-race.ConfirmationCutoffHours),
            // San dua (patch 011) — ke thua tu giai.
            VenueName = venue?.Name,
            VenueCity = venue?.City,
            VenueTrackType = venue?.TrackType,
            LaneCount = venue?.LaneCount,
            TrackLengthMeters = venue?.TrackLengthMeters,
            RaceCapacity = venue == null
                ? null
                : Math.Min(race.Round.Tournament.MaxHorses, venue.LaneCount),
            Entries = race.RaceEntries
                // Khong hien thi entry da huy tren lich cong khai.
                .Where(e => e.Status != "Cancelled")
                .OrderBy(e => e.PostPosition ?? int.MaxValue)
                .Select(e => new RaceScheduleEntryDto
                {
                    RaceEntryId = e.RaceEntryId,
                    PostPosition = e.PostPosition,
                    Status = e.Status,
                    HorseId = e.Pairing.HorseId,
                    HorseName = e.Pairing.Horse.Name,
                    JockeyId = e.Pairing.JockeyId,
                    JockeyName = e.Pairing.Jockey.Jockey.FullName
                })
                .ToList()
        };
    }

    // =====================================================================
    // Owner xác nhận tham gia
    // =====================================================================
    public async Task<RaceEntryResponseDto> ConfirmAsync(int ownerId, int raceEntryId)
    {
        var entry = await _context.RaceEntries
            .Include(e => e.Race)
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId)
            ?? throw new KeyNotFoundException("ENTRY_NOT_FOUND");

        // Chi chu cua ngua moi duoc xac nhan.
        if (entry.Pairing.Horse.OwnerId != ownerId)
            throw new UnauthorizedAccessException("FORBIDDEN");

        // Chi entry Pending moi co the xac nhan.
        if (entry.Status != "Pending")
            throw new InvalidOperationException("INVALID_STATUS");

        // Giai thu phi: Admin phai xac nhan le phi (Unpaid -> Paid) truoc khi Owner
        // duoc confirm. Giai mien phi (EntryFeeAmount == 0) da duoc auto-set Paid
        // ngay khi tao entry (AllocateAsync) nen khong can check EntryFeeAmount o day.
        if (entry.EntryFeeStatus != "Paid")
            throw new InvalidOperationException("ENTRY_FEE_NOT_PAID");

        // Enrollment cua ngua trong giai nay phai con Approved tai thoi diem xac nhan
        // (Admin co the reject enrollment sau khi entry duoc tao).
        var enrollmentApproved = await _context.HorseTournamentEntries.AnyAsync(e =>
            e.HorseId == entry.Pairing.HorseId &&
            e.TournamentId == entry.Pairing.TournamentId &&
            e.Status == "Enrolled" &&
            e.AdminApprovalStatus == "Approved");
        if (!enrollmentApproved)
            throw new InvalidOperationException("HORSE_NOT_APPROVED_IN_TOURNAMENT");

        // Da qua Confirmation Cut-off thi khong cho xac nhan nua (se bi auto-cancel).
        var cutoff = entry.Race.ScheduledTime.AddHours(-entry.Race.ConfirmationCutoffHours);
        if (DateTime.UtcNow > cutoff)
            throw new InvalidOperationException("CONFIRMATION_CLOSED");

        entry.Status = "Confirmed";
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _audit.LogAsync(ownerId, "Xác nhận tham gia cuộc đua", "RaceEntry",
            entry.RaceEntryId.ToString(), "Pending", "Confirmed");

        return MapToResponse(entry, entry.Pairing);
    }

    // =====================================================================
    // Withdrawal Flow (idempotent)
    // =====================================================================
    public async Task<WithdrawResultDto> WithdrawAsync(
        int actorId, int raceEntryId, WithdrawEntryDto dto, bool isSystem = false)
    {
        var entry = await _context.RaceEntries
            .Include(e => e.Race)
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId)
            ?? throw new KeyNotFoundException("ENTRY_NOT_FOUND");

        // Owner chi rut duoc entry cua chinh minh (job he thong bo qua check nay).
        if (!isSystem && entry.Pairing.Horse.OwnerId != actorId)
            throw new UnauthorizedAccessException("FORBIDDEN");

        // Da rut roi -> tra ket qua idempotent, khong lam gi them.
        if (entry.Status is "Cancelled" or "Scratched")
        {
            return new WithdrawResultDto
            {
                RaceEntryId = raceEntryId,
                Status = entry.Status,
                RefundedPredictions = 0,
                AlreadyWithdrawn = true,
                Message = "Đăng ký này đã bị hủy trước đó."
            };
        }

        // Race phai con Upcoming (moi actor) — khong duoc pha du lieu race
        // Live/Unofficial/Official (ket qua, payout, leaderboard tham chieu entry).
        var isLateWithdrawal = entry.Race.Status == "Pre-Race";
        if (entry.Race.Status != "Upcoming" && !isLateWithdrawal)
            throw new InvalidOperationException("RACE_NOT_UPCOMING");

        // Owner tu rut chi truoc Confirmation Cut-off; sau cut-off chi Admin/system
        // (isSystem = true) duoc huy de dieu phoi khan cap.
        var withdrawCutoff = entry.Race.ScheduledTime.AddHours(-entry.Race.ConfirmationCutoffHours);
        if (!isLateWithdrawal && !isSystem && DateTime.UtcNow > withdrawCutoff)
            throw new InvalidOperationException("WITHDRAW_AFTER_CUTOFF");
        if (isLateWithdrawal && (string.IsNullOrWhiteSpace(dto.Reason) || dto.Reason.Trim().Length < 10))
            throw new InvalidOperationException("LATE_WITHDRAW_REASON_REQUIRED");

        var reason = string.IsNullOrWhiteSpace(dto.Reason)
            ? (isSystem ? "Tự động hủy: quá hạn xác nhận tham gia" : "Chủ ngựa tự rút lui")
            : dto.Reason!;

        var now = DateTime.UtcNow;

        // Rút SAU bốc thăm (patch 012) -> 'Scratched': GIỮ nguyên PostPosition để
        // cổng đó bỏ trống, không bốc lại và không xô lệch cổng của ngựa khác.
        // Rút TRƯỚC bốc thăm -> 'Cancelled', giải phóng chỗ cho pairing khác.
        var isScratch = entry.Race.IsPostPositionDrawn;
        var targetStatus = isScratch ? "Scratched" : "Cancelled";

        // Cascade flow (reject enrollment / update horse / cancel race) có thể đã mở
        // transaction bên ngoài — không mở lồng, chỉ commit/rollback khi mình là chủ.
        var ownsTransaction = _context.Database.CurrentTransaction == null;
        var tx = ownsTransaction ? await _context.Database.BeginTransactionAsync() : null;
        try
        {
            // Guard nguyên tử: chỉ flip khi đang Pending/Confirmed. ExecuteUpdate trả về số dòng
            // bi anh huong -> dong vai tro @@ROWCOUNT, chong race condition + chong huy 2 lan.
            var rows = await _context.RaceEntries
                .Where(e => e.RaceEntryId == raceEntryId &&
                            (e.Status == "Pending" || e.Status == "Confirmed"))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(e => e.Status, targetStatus)
                    .SetProperty(e => e.PostPosition, e => isScratch ? e.PostPosition : null)
                    .SetProperty(e => e.IsWithdrawn, true)
                    .SetProperty(e => e.WithdrawalReason, reason)
                    .SetProperty(e => e.UpdatedAt, now));

            if (rows == 0)
            {
                // Mot tien trinh khac da xu ly truoc -> idempotent.
                if (tx != null) await tx.CommitAsync();
                return new WithdrawResultDto
                {
                    RaceEntryId = raceEntryId,
                    Status = targetStatus,
                    RefundedPredictions = 0,
                    AlreadyWithdrawn = true,
                    Message = "Đăng ký đã được xử lý bởi một thao tác khác."
                };
            }

            // Entry đã thanh toán -> chuyển Refund Pending để Module N xử lý hoàn phí.
            if (entry.EntryFeeStatus == "Paid")
            {
                await _context.RaceEntries
                    .Where(e => e.RaceEntryId == raceEntryId)
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.EntryFeeStatus, "Refund Pending"));
            }

            // SCH.5: hoàn điểm ảo NGAY trong transaction withdraw — cộng ví + ghi sổ cái
            // 'Prediction Refund' cho từng prediction Pending rồi mới đánh dấu Refunded.
            // Guard idempotent ở entry (rows == 0 ở trên) bảo đảm không refund hai lần.
            var pendingPredictions = await _context.Predictions
                .Where(p => p.RaceEntryId == raceEntryId && p.Status == "Pending")
                .ToListAsync();
            var refunded = await RefundPredictionsAsync(
                pendingPredictions,
                $"Ngựa bạn dự đoán ở cuộc đua #{entry.RaceId} đã rút khỏi cuộc đua. Điểm dự đoán đã được hoàn về ví.",
                "RaceEntry", raceEntryId, now);

            // Thong bao khan URGENT cho tat ca Admin de dieu phoi phuong an du phong.
            var adminIds = await _context.Users
                .Where(u => u.Role == "Admin" && u.Status == "Active")
                .Select(u => u.UserId)
                .ToListAsync();

            if (adminIds.Count > 0)
            {
                await _notification.SendBulkAsync(
                    adminIds,
                    "Khẩn: Có ngựa rút khỏi cuộc đua",
                    $"Mã đăng ký {raceEntryId} ở cuộc đua #{entry.RaceId} đã bị hủy. Lý do: {reason}. " +
                    (isScratch
                        ? $"Đã bốc thăm nên cổng số {entry.PostPosition} sẽ để trống."
                        : "Vị trí xuất phát đã được giải phóng."),
                    type: "Both",
                    relatedEntityType: "RaceEntry",
                    relatedEntityId: raceEntryId);
            }

            // Bao Owner va Jockey cua cap dau bi huy (dung SRS: 3 ben).
            // Pairing.JockeyId = Users.UserId (shared PK voi JockeyProfiles).
            await _notification.SendAsync(
                entry.Pairing.Horse.OwnerId,
                "Đăng ký cuộc đua đã bị hủy",
                $"Ngựa '{entry.Pairing.Horse.Name}' đã rút khỏi cuộc đua #{entry.RaceId}. Lý do: {reason}.",
                type: "Both",
                relatedEntityType: "RaceEntry",
                relatedEntityId: raceEntryId);

            await _notification.SendAsync(
                entry.Pairing.JockeyId,
                "Đăng ký cuộc đua đã bị hủy",
                $"Cặp đấu với ngựa '{entry.Pairing.Horse.Name}' ở cuộc đua #{entry.RaceId} đã bị hủy. Lý do: {reason}.",
                type: "Both",
                relatedEntityType: "RaceEntry",
                relatedEntityId: raceEntryId);

            // Rut sau boc tham HOAC sau Pre-Race deu can bao Referee/Doctor de dieu
            // phoi tai cho (cong bo trong, danh sach kiem tra doi).
            if (isLateWithdrawal || isScratch)
            {
                var refereeIds = await _context.RefereeAssignments
                    .Where(a => a.RaceId == entry.RaceId)
                    .Select(a => a.RefereeId)
                    .ToListAsync();
                var doctorIds = await _context.DoctorAssignments
                    .Where(a => a.RaceId == entry.RaceId)
                    .Select(a => a.DoctorId)
                    .ToListAsync();
                await _notification.SendBulkAsync(refereeIds.Concat(doctorIds),
                    isScratch ? "Khẩn: Ngựa rút sau bốc thăm" : "Khẩn: Rút lui sau Pre-Race",
                    $"Race entry #{raceEntryId} đã rút khỏi cuộc đua #{entry.RaceId}. Lý do: {reason}." +
                    (isScratch ? $" Cổng số {entry.PostPosition} để trống, KHÔNG bốc thăm lại." : string.Empty),
                    type: "Both", relatedEntityType: "RaceEntry", relatedEntityId: raceEntryId);
            }

            await _audit.LogAsync(actorId,
                isSystem ? "Tự động hủy đăng ký đua (quá hạn xác nhận)" : "Rút khỏi cuộc đua",
                "RaceEntry", raceEntryId.ToString(),
                entry.Status, $"{targetStatus};Refunded={refunded};Reason={reason}");

            if (tx != null) await tx.CommitAsync();

            return new WithdrawResultDto
            {
                RaceEntryId = raceEntryId,
                Status = targetStatus,
                RefundedPredictions = refunded,
                AlreadyWithdrawn = false,
                Message = isScratch
                    ? "Đã rút khỏi cuộc đua sau bốc thăm; cổng xuất phát để trống và điểm dự đoán đã hoàn."
                    : "Đã hủy đăng ký, giải phóng vị trí xuất phát và hoàn điểm dự đoán."
            };
        }
        catch
        {
            if (tx != null) await tx.RollbackAsync();
            throw;
        }
        finally
        {
            if (tx != null) await tx.DisposeAsync();
        }
    }

    // =====================================================================
    // Hoàn điểm dự đoán: cộng ví + ghi sổ cái + đánh dấu Refunded (cùng transaction)
    // =====================================================================
    // Giữ bất biến Balance = SUM(VirtualPointsTransactions.Amount). Thiếu ví -> throw
    // để rollback toàn bộ (giống EmergencyDisqualificationService), không mất điểm im lặng.
    private async Task<int> RefundPredictionsAsync(
        List<Prediction> pendingPredictions,
        string notificationMessage,
        string relatedEntityType,
        int relatedEntityId,
        DateTime now)
    {
        if (pendingPredictions.Count == 0)
            return 0;

        var spectatorIds = pendingPredictions.Select(p => p.SpectatorId).Distinct().ToList();
        var wallets = await _context.Wallets
            .Where(w => spectatorIds.Contains(w.SpectatorId))
            .ToDictionaryAsync(w => w.SpectatorId);

        foreach (var prediction in pendingPredictions)
        {
            if (!wallets.TryGetValue(prediction.SpectatorId, out var wallet))
                throw new InvalidOperationException("WALLET_NOT_FOUND");

            wallet.Balance += prediction.PointsPlaced;
            wallet.UpdatedAt = now;

            _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
            {
                WalletId = wallet.WalletId,
                Amount = prediction.PointsPlaced,
                Type = "Prediction Refund",
                ReferenceId = $"Prediction:{prediction.PredictionId}",
                CreatedAt = now
            });

            prediction.Status = "Refunded";
            prediction.PointsAwarded = 0;
        }

        await _context.SaveChangesAsync();

        // In-app cho spectator bị ảnh hưởng (trong cùng transaction — cùng số phận commit/rollback).
        foreach (var spectatorId in spectatorIds)
        {
            await _notification.SendAsync(
                spectatorId,
                "Hoàn điểm dự đoán",
                notificationMessage,
                relatedEntityType: relatedEntityType,
                relatedEntityId: relatedEntityId);
        }

        return pendingPredictions.Count;
    }

    // =====================================================================
    // Job nén: tự động cancel các entry quá hạn
    // =====================================================================
    public async Task<int> AutoCancelOverdueAsync()
    {
        var now = DateTime.UtcNow;

        // Entry van Pending (chua xac nhan) cua Race sap chay va da qua moc cut-off.
        var overdueIds = await _context.RaceEntries
            .Include(e => e.Race)
            .Where(e => e.Status == "Pending" &&
                        e.Race.Status == "Upcoming" &&
                        e.Race.ScheduledTime.AddHours(-e.Race.ConfirmationCutoffHours) < now)
            .Select(e => e.RaceEntryId)
            .ToListAsync();

        if (overdueIds.Count == 0)
            return 0;

        // Actor cho job nen: user he thong chuan (patch 006 seed Username = 'system',
        // Role = 'System') — audit ghi dung "he thong tu dong huy", khong muon
        // tai khoan Admin that. Thieu system user = moi truong chua chay patch 006
        // → fail ro rang thay vi ghi audit sai actor.
        var systemActorId = await _context.Users
            .Where(u => u.Role == "System" && u.Status == "Active")
            .Select(u => u.UserId)
            .FirstOrDefaultAsync();
        if (systemActorId == 0)
            throw new InvalidOperationException("SYSTEM_USER_NOT_FOUND");

        var count = 0;
        foreach (var id in overdueIds)
        {
            await WithdrawAsync(systemActorId, id,
                new WithdrawEntryDto { Reason = "Tự động hủy: quá hạn xác nhận tham gia" },
                isSystem: true);
            count++;
        }

        return count;
    }

    // =====================================================================
    // Admin hủy một cuộc đua chưa Official (SCH.9 — nhánh hủy race)
    // =====================================================================
    public async Task<CancelRaceResultDto> CancelRaceAsync(int adminId, int raceId, string? reason)
    {
        var race = await _context.Races
            .Include(r => r.RaceEntries).ThenInclude(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        // Race Official la ket qua chinh thuc — khong duoc huy (bat bien du lieu lich su).
        if (race.Status == "Official")
            throw new InvalidOperationException("RACE_ALREADY_OFFICIAL");
        if (race.Status == "Cancelled")
            throw new InvalidOperationException("RACE_ALREADY_CANCELLED");

        var cancelReason = string.IsNullOrWhiteSpace(reason) ? "Race cancelled by admin" : reason!;
        var now = DateTime.UtcNow;

        var ownsTransaction = _context.Database.CurrentTransaction == null;
        var tx = ownsTransaction ? await _context.Database.BeginTransactionAsync() : null;
        try
        {
            var cancelledEntries = 0;
            foreach (var entry in race.RaceEntries
                         .Where(e => e.Status is "Pending" or "Confirmed"))
            {
                // Guard nguyen tu tung entry (giong WithdrawAsync) — chong chay cheo
                // voi mot withdraw song song tren cung entry.
                var rows = await _context.RaceEntries
                    .Where(e => e.RaceEntryId == entry.RaceEntryId &&
                                (e.Status == "Pending" || e.Status == "Confirmed"))
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.Status, "Cancelled")
                        .SetProperty(e => e.PostPosition, (int?)null)
                        .SetProperty(e => e.IsWithdrawn, true)
                        .SetProperty(e => e.WithdrawalReason, cancelReason)
                        .SetProperty(e => e.UpdatedAt, now));
                if (rows == 0) continue;
                cancelledEntries++;

                // HRS.8: entry Paid -> Refund Pending trong cung transaction huy.
                if (entry.EntryFeeStatus == "Paid")
                {
                    await _context.RaceEntries
                        .Where(e => e.RaceEntryId == entry.RaceEntryId)
                        .ExecuteUpdateAsync(s => s.SetProperty(e => e.EntryFeeStatus, "Refund Pending"));
                }

                await _notification.SendAsync(
                    entry.Pairing.Horse.OwnerId,
                    "Cuộc đua bị hủy",
                    $"Cuộc đua #{raceId} đã bị hủy. Đăng ký của ngựa '{entry.Pairing.Horse.Name}' được hủy kèm theo. Lý do: {cancelReason}.",
                    type: "Both",
                    relatedEntityType: "RaceEntry",
                    relatedEntityId: entry.RaceEntryId);

                await _notification.SendAsync(
                    entry.Pairing.JockeyId,
                    "Cuộc đua bị hủy",
                    $"Cuộc đua #{raceId} đã bị hủy. Cặp đấu với ngựa '{entry.Pairing.Horse.Name}' được hủy kèm theo. Lý do: {cancelReason}.",
                    type: "Both",
                    relatedEntityType: "RaceEntry",
                    relatedEntityId: entry.RaceEntryId);
            }

            // Hoan diem TOAN BO prediction Pending cua race — ke ca prediction con sot
            // tren entry da Cancelled truoc do (du lieu cu truoc fix refund).
            var pendingPredictions = await _context.Predictions
                .Where(p => p.RaceId == raceId && p.Status == "Pending")
                .ToListAsync();
            var refunded = await RefundPredictionsAsync(
                pendingPredictions,
                $"Cuộc đua #{raceId} đã bị hủy. Điểm dự đoán đã được hoàn về ví.",
                "Race", raceId, now);

            var oldStatus = race.Status;
            race.Status = "Cancelled";
            race.IsPredictionGateClosed = true;
            race.UpdatedAt = now;
            await _context.SaveChangesAsync();

            await _audit.LogAsync(adminId, "Hủy cuộc đua", "Race", raceId.ToString(),
                oldStatus, $"Cancelled;Entries={cancelledEntries};Refunded={refunded};Reason={cancelReason}");

            if (tx != null) await tx.CommitAsync();

            return new CancelRaceResultDto
            {
                RaceId = raceId,
                Status = "Cancelled",
                CancelledEntries = cancelledEntries,
                RefundedPredictions = refunded
            };
        }
        catch
        {
            if (tx != null) await tx.RollbackAsync();
            throw;
        }
        finally
        {
            if (tx != null) await tx.DisposeAsync();
        }
    }

    // =====================================================================
    // Guard đóng băng cấu hình Race
    // =====================================================================
    public async Task EnsureRaceConfigEditableAsync(int raceId)
    {
        var race = await _context.Races
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        if (race.IsPostPositionDrawn)
            throw new InvalidOperationException("RACE_CONFIG_FROZEN");

        var hasPrediction = await _context.Predictions.AnyAsync(p => p.RaceId == raceId);
        if (hasPrediction)
            throw new InvalidOperationException("RACE_CONFIG_FROZEN");
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    // Giai chi cho xep lich (allocate/draw) khi o Open/Closed Registration (Q4).
    private static void EnsureTournamentOpenForScheduling(string tournamentStatus)
    {
        if (tournamentStatus != "Open Registration" && tournamentStatus != "Closed Registration")
            throw new InvalidOperationException("TOURNAMENT_NOT_OPEN_FOR_SCHEDULING");
    }

    // StartDate <= Round.ScheduledDate <= Race.ScheduledTime <= EndDate, và > Now.
    private static void ValidateScheduleWindow(Race race)
    {
        var tournament = race.Round.Tournament;

        if (race.ScheduledTime <= DateTime.UtcNow)
            throw new InvalidOperationException("RACE_IN_PAST");

        if (race.ScheduledTime < tournament.StartDate || race.ScheduledTime > tournament.EndDate)
            throw new InvalidOperationException("RACE_OUT_OF_WINDOW");

        if (race.ScheduledTime < race.Round.ScheduledDate)
            throw new InvalidOperationException("RACE_BEFORE_ROUND");
    }

    private static RaceEntryResponseDto MapToResponse(RaceEntry entry, Pairing pairing) => new()
    {
        RaceEntryId = entry.RaceEntryId,
        RaceId = entry.RaceId,
        PairingId = entry.PairingId,
        PostPosition = entry.PostPosition,
        Status = entry.Status,
        EntryFeeStatus = entry.EntryFeeStatus,
        IsWithdrawn = entry.IsWithdrawn,
        HorseId = pairing.HorseId,
        HorseName = pairing.Horse.Name,
        JockeyId = pairing.JockeyId,
        JockeyName = pairing.Jockey.Jockey.FullName,
        CreatedAt = entry.CreatedAt,
        UpdatedAt = entry.UpdatedAt
    };
}
