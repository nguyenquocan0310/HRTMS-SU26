using HRTMS.Core.DTOs.RaceEntry;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

// Module E — Lap lich, Boc tham & Rut lui (REQ-F-SCH).
// Theo convention HRTMS: service dung HRTMSDbContext truc tiep, nem exception voi
// "error code" la message de Controller map sang HTTP status.
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
    // SCH.1 — Phan bo Pairing vao Race
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

        // EC-48: da boc tham roi thi khong them entry duoc nua (danh sach xuat phat da chot).
        if (race.IsPostPositionDrawn)
            throw new InvalidOperationException("RACE_ALREADY_DRAWN");

        // Chi cho phan bo khi Race con Upcoming.
        if (race.Status != "Upcoming")
            throw new InvalidOperationException("INVALID_RACE_STATE");

        // SCH.6 / EC-35 — cua so thoi gian phai con hop le.
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

        // SRS SCH.1 — chi cap da Confirmed (jockey accept + owner confirm) moi duoc dua vao dua.
        // "Accepted" moi chi la jockey dong y, owner chua confirm -> chua du dieu kien.
        if (pairing.Status != "Confirmed")
            throw new InvalidOperationException("PAIRING_NOT_CONFIRMED");

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

        // Ngua phai da duoc Admin duyet.
        if (pairing.Horse.AdminApprovalStatus != "Approved")
            throw new InvalidOperationException("HORSE_NOT_APPROVED");

        // EC-21 (BR-05) — tai kiem tra kinh nghiem Jockey tai thoi diem dua cap vao Race cu the,
        // vi nguong MinJockeyExperienceYears phu thuoc tung giai.
        if (pairing.Jockey.ExperienceYears < race.Round.Tournament.MinJockeyExperienceYears)
            throw new InvalidOperationException("JOCKEY_EXPERIENCE_TOO_LOW");

        // SCH.7 / EC-46 — chan khi so entry hop le da dat MaxHorses (khong ap so toi thieu).
        var currentCount = await _context.RaceEntries
            .CountAsync(e => e.RaceId == raceId && ActiveEntryStatuses.Contains(e.Status));
        if (currentCount >= race.Round.Tournament.MaxHorses)
            throw new InvalidOperationException("MAX_HORSES_REACHED");

        // SCH.8 / EC-40 — chan cung HorseId hoac JockeyId xuat hien 2 lan trong CUNG mot Race.
        var duplicateInRace = await _context.RaceEntries
            .Include(e => e.Pairing)
            .AnyAsync(e =>
                e.RaceId == raceId &&
                ActiveEntryStatuses.Contains(e.Status) &&
                (e.Pairing.HorseId == pairing.HorseId ||
                 e.Pairing.JockeyId == pairing.JockeyId));
        if (duplicateInRace)
            throw new InvalidOperationException("DUPLICATE_IN_RACE");

        // SCH.8 / EC-15 — chan double-booking: cung Horse/Jockey o Race khac cung gio chay.
        // Pha 1 dinh nghia "chong lap" = trung ScheduledTime (chua co truong thoi luong dua).
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

        await _audit.LogAsync(adminId, "ALLOCATE_RACE_ENTRY", "RaceEntry",
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
    // SCH.2 — Boc tham vi tri xuat phat (NGUYEN TU)
    // =====================================================================
    public async Task<PostPositionDrawResultDto> DrawPostPositionsAsync(int adminId, int raceId)
    {
        var race = await _context.Races
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

        // Khong boc tham 2 lan (idempotent-guard, tranh xao tron lai cong da cong khai).
        if (race.IsPostPositionDrawn)
            throw new InvalidOperationException("ALREADY_DRAWN");

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

        await _audit.LogAsync(adminId, "DRAW_POST_POSITIONS", "Race",
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
    // SCH.3 — Lich thi dau cong khai
    // =====================================================================
    public async Task<RaceScheduleDto> GetRaceScheduleAsync(int raceId)
    {
        var race = await _context.Races
            .Include(r => r.RaceEntries).ThenInclude(e => e.Pairing).ThenInclude(p => p.Horse)
            .Include(r => r.RaceEntries).ThenInclude(e => e.Pairing).ThenInclude(p => p.Jockey).ThenInclude(j => j.Jockey)
            .FirstOrDefaultAsync(r => r.RaceId == raceId)
            ?? throw new KeyNotFoundException("RACE_NOT_FOUND");

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
    // SCH.4 — Owner xac nhan tham gia
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

        // Da qua Confirmation Cut-off thi khong cho xac nhan nua (se bi auto-cancel).
        var cutoff = entry.Race.ScheduledTime.AddHours(-entry.Race.ConfirmationCutoffHours);
        if (DateTime.UtcNow > cutoff)
            throw new InvalidOperationException("CONFIRMATION_CLOSED");

        entry.Status = "Confirmed";
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _audit.LogAsync(ownerId, "CONFIRM_RACE_ENTRY", "RaceEntry",
            entry.RaceEntryId.ToString(), "Pending", "Confirmed");

        return MapToResponse(entry, entry.Pairing);
    }

    // =====================================================================
    // SCH.5 — Withdrawal Flow (idempotent)
    // =====================================================================
    public async Task<WithdrawResultDto> WithdrawAsync(
        int actorId, int raceEntryId, WithdrawEntryDto dto, bool isSystem = false)
    {
        var entry = await _context.RaceEntries
            .Include(e => e.Pairing).ThenInclude(p => p.Horse)
            .FirstOrDefaultAsync(e => e.RaceEntryId == raceEntryId)
            ?? throw new KeyNotFoundException("ENTRY_NOT_FOUND");

        // Owner chi rut duoc entry cua chinh minh (job he thong bo qua check nay).
        if (!isSystem && entry.Pairing.Horse.OwnerId != actorId)
            throw new UnauthorizedAccessException("FORBIDDEN");

        // Da Cancelled -> tra ket qua idempotent, khong lam gi them.
        if (entry.Status == "Cancelled")
        {
            return new WithdrawResultDto
            {
                RaceEntryId = raceEntryId,
                Status = "Cancelled",
                RefundedPredictions = 0,
                AlreadyWithdrawn = true,
                Message = "Entry was already cancelled."
            };
        }

        var reason = string.IsNullOrWhiteSpace(dto.Reason)
            ? (isSystem ? "Auto-cancelled: confirmation cut-off passed" : "Withdrawn by owner")
            : dto.Reason!;

        var now = DateTime.UtcNow;

        await using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // Guard nguyen tu (BR-36): chi flip khi dang Pending/Confirmed. ExecuteUpdate tra ve so dong
            // bi anh huong -> dong vai tro @@ROWCOUNT, chong race condition + chong huy 2 lan.
            var rows = await _context.RaceEntries
                .Where(e => e.RaceEntryId == raceEntryId &&
                            (e.Status == "Pending" || e.Status == "Confirmed"))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(e => e.Status, "Cancelled")
                    .SetProperty(e => e.PostPosition, (int?)null) // giai phong cong -> Vacant
                    .SetProperty(e => e.IsWithdrawn, true)
                    .SetProperty(e => e.WithdrawalReason, reason)
                    .SetProperty(e => e.UpdatedAt, now));

            if (rows == 0)
            {
                // Mot tien trinh khac da xu ly truoc -> idempotent.
                await tx.CommitAsync();
                return new WithdrawResultDto
                {
                    RaceEntryId = raceEntryId,
                    Status = "Cancelled",
                    RefundedPredictions = 0,
                    AlreadyWithdrawn = true,
                    Message = "Entry already processed by another operation."
                };
            }

            // Entry da thanh toan -> chuyen Refund Pending (REQ-F-HRS.8) de Module N xu ly hoan phi.
            if (entry.EntryFeeStatus == "Paid")
            {
                await _context.RaceEntries
                    .Where(e => e.RaceEntryId == raceEntryId)
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.EntryFeeStatus, "Refund Pending"));
            }

            // Hoan diem du doan: chi tren Prediction dang Pending -> Refunded (idempotent).
            // Viec cong tra diem vao vi (VirtualPointsTransaction) thuoc Module N; o day chi danh dau trang thai.
            var refunded = await _context.Predictions
                .Where(p => p.RaceEntryId == raceEntryId && p.Status == "Pending")
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, "Refunded"));

            // Thong bao khan URGENT cho tat ca Admin de dieu phoi phuong an du phong.
            var adminIds = await _context.Users
                .Where(u => u.Role == "Admin" && u.Status == "Active")
                .Select(u => u.UserId)
                .ToListAsync();

            if (adminIds.Count > 0)
            {
                await _notification.SendBulkAsync(
                    adminIds,
                    "URGENT: Race entry withdrawn",
                    $"RaceEntry #{raceEntryId} (Race #{entry.RaceId}) đã bị hủy. Lý do: {reason}. " +
                    $"Vị trí xuất phát đã được giải phóng (Vacant).",
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

            await _audit.LogAsync(actorId,
                isSystem ? "AUTO_CANCEL_RACE_ENTRY" : "WITHDRAW_RACE_ENTRY",
                "RaceEntry", raceEntryId.ToString(),
                entry.Status, $"Cancelled;Refunded={refunded};Reason={reason}");

            await tx.CommitAsync();

            return new WithdrawResultDto
            {
                RaceEntryId = raceEntryId,
                Status = "Cancelled",
                RefundedPredictions = refunded,
                AlreadyWithdrawn = false,
                Message = "Entry cancelled, post position released, predictions refunded."
            };
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // =====================================================================
    // SCH.5 — Job nen: tu dong cancel cac entry qua han (BR-08)
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

        // Actor cho job nen: dung Admin Active dau tien (AuditLog.ActorId la FK NOT NULL).
        var systemActorId = await _context.Users
            .Where(u => u.Role == "Admin" && u.Status == "Active")
            .Select(u => u.UserId)
            .FirstOrDefaultAsync();

        var count = 0;
        foreach (var id in overdueIds)
        {
            await WithdrawAsync(systemActorId, id,
                new WithdrawEntryDto { Reason = "Auto-cancelled: confirmation cut-off passed" },
                isSystem: true);
            count++;
        }

        return count;
    }

    // =====================================================================
    // SCH.9 — Guard dong bang cau hinh Race
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

    // SCH.6 / EC-35 — StartDate <= Round.ScheduledDate <= Race.ScheduledTime <= EndDate, va > Now.
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
