using HRTMS.Core.DTOs.Tournament;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services
{
    public class TournamentSevice : ITournamentServices
    {
        private readonly HRTMSDbContext _context;
        private readonly IAuditLogService _auditLog;
        // Guard đóng băng cấu hình Race dùng chung với RaceEntryService,
        // tránh viết lại logic freeze inline.
        private readonly IRaceEntryService _raceEntry;
        private readonly INotificationService _notification;

        private static readonly string[] ValidBreeds =
            ["Thoroughbred", "Arabian", "Quarter Horse", "Mixed"];
        private static readonly string[] ValidTrackType =
            ["Turf", "Dirt", "Synthetic"];
        private static readonly string[] ValidCategories =
            ["Open", "Classic", "Maiden"];
        // Progression (patch 002). MVP chi ho tro 'TopPerRace' — 'EarningsBased'/'Hybrid'
        // chua auto-compute khi Declare Official nen CHAN CHON tu dau (tranh giai
        // multi-round chet cung vi entry khong bao gio co AdvancementStatus).
        // CHK_Tournaments_AdvRule o DB van rong hon (giu nguyen, khong can patch).
        private static readonly string[] ValidAdvancementRules = ["TopPerRace"];
        private const int MinRaceDistanceMeters = 1200;
        private const int MaxRaceDistanceMeters = 2400;
        // State machine cấp GIẢI một chiều: Draft → Open Registration → Closed Registration → Completed
        // (nhánh Cancelled xử lý riêng ở CancelTournamentAsync). Pre-Race/Live/In-Progress/Unofficial/Official
        // là trạng thái cấp RACE, KHÔNG lưu ở Tournament.
        private static readonly Dictionary<string, string> ValidTransitions = new()
        {
            ["Draft"]               = "Open Registration",
            ["Open Registration"]   = "Closed Registration",
            ["Closed Registration"] = "Completed",
        };

        // Các trạng thái thuộc cấp Race — không bao giờ được set cho Tournament.
        private static readonly string[] RaceLevelStatuses =
            ["Pre-Race", "Live", "In-Progress", "Unofficial", "Official"];

        public TournamentSevice(
            HRTMSDbContext context,
            IAuditLogService auditLog,
            IRaceEntryService raceEntry,
            INotificationService notification)
        {
            _context = context;
            _auditLog = auditLog;
            _raceEntry = raceEntry;
            _notification = notification;
        }


        // PRIVATE HELPER
        private static void ValidateRaceDistance(int distance, string fieldName)
        {
            if (distance <= MinRaceDistanceMeters || distance >= MaxRaceDistanceMeters)
                throw new ArgumentException($"{fieldName} phải lớn hơn {MinRaceDistanceMeters}m và nhỏ hơn {MaxRaceDistanceMeters}m.");
        }

        private static void ValidateRaceDistanceOverride(int? distance)
        {
            if (distance.HasValue)
                ValidateRaceDistance(distance.Value, "RaceDistanceOverride");
        }

        private static void ValidateTournamentWindow(DateTime startDate, DateTime endDate)
        {
            if (endDate <= startDate)
                throw new ArgumentException("Ngày kết thúc phải sau ngày bắt đầu.");
        }

        private static void ValidateTournamentNumbers(
            int maxHorses,
            int minJockeyExperienceYears,
            decimal purseAmount,
            decimal entryFeeAmount,
            decimal preRaceWeightThresholdKg,
            decimal postRaceWeightDiffThresholdKg)
        {
            if (maxHorses <= 0)
                throw new ArgumentException("Số ngựa tối đa phải lớn hơn 0.");
            if (minJockeyExperienceYears < 0)
                throw new ArgumentException("Số năm kinh nghiệm tối thiểu của nài không được âm.");
            if (purseAmount < 0)
                throw new ArgumentException("Tổng giải thưởng không được âm.");
            if (entryFeeAmount < 0)
                throw new ArgumentException("Lệ phí tham gia không được âm.");
            if (preRaceWeightThresholdKg <= 0)
                throw new ArgumentException("Ngưỡng cân trước đua phải lớn hơn 0.");
            if (postRaceWeightDiffThresholdKg <= 0)
                throw new ArgumentException("Ngưỡng chênh cân sau đua phải lớn hơn 0.");
        }

        private static void ValidateTournamentScheduleIntegrity(Tournament tournament)
        {
            foreach (var round in tournament.Rounds)
            {
                if (round.ScheduledDate < tournament.StartDate || round.ScheduledDate > tournament.EndDate)
                    throw new ArgumentException($"Vòng #{round.RoundId} nằm ngoài khoảng thời gian của giải.");

                foreach (var race in round.Races)
                {
                    if (race.ScheduledTime < tournament.StartDate || race.ScheduledTime > tournament.EndDate)
                        throw new ArgumentException($"Cuộc đua #{race.RaceId} nằm ngoài khoảng thời gian của giải.");
                    if (race.ScheduledTime < round.ScheduledDate)
                        throw new ArgumentException($"Cuộc đua #{race.RaceId} được xếp trước ngày của vòng.");
                }
            }

            var allocatedPurse = tournament.Rounds
                .SelectMany(r => r.Races)
                .Sum(r => r.PurseAmount);
            if (allocatedPurse > tournament.PurseAmount)
                throw new ArgumentException($"Tổng giải thưởng các cuộc đua ({allocatedPurse}) vượt quá tổng giải thưởng của giải ({tournament.PurseAmount}).");
        }

        private static TournamentResponseDto MapToResponseDto(Tournament t)
        {
            var allocatedPurse = t.Rounds.SelectMany(r => r.Races).Sum(race => race.PurseAmount);

            return new TournamentResponseDto
            {
                TournamentId = t.TournamentId,
                Name = t.Name,
                Description = t.Description,
                StartDate = t.StartDate,
                EndDate = t.EndDate,
                MaxHorses = t.MaxHorses,
                AllowedBreed = t.AllowedBreed,
                TrackType = t.TrackType,
                RaceDistance = t.RaceDistance,
                RaceCategory = t.RaceCategory,
                MinJockeyExperienceYears = t.MinJockeyExperienceYears,
                PurseAmount = t.PurseAmount,
                AllocatedPurse = allocatedPurse,
                RemainingPurse = t.PurseAmount - allocatedPurse,
                EntryFeeAmount = t.EntryFeeAmount,
                PreRaceWeightThresholdKg = t.PreRaceWeightThresholdKg,
                PostRaceWeightDiffThresholdKg = t.PostRaceWeightDiffThresholdKg,
                Status = t.Status,
                AdvancementRule = t.AdvancementRule,
                AdvancementCount = t.AdvancementCount,
                CreatedAt = t.CreatedAt,
                Rounds = t.Rounds.Select(r => new RoundResponseDto
                {
                    RoundId = r.RoundId,
                    Name = r.Name,
                    SequenceOrder = r.SequenceOrder,
                    ScheduledDate = r.ScheduledDate,
                    Status = r.Status,
                    AllocatedPurse = r.Races.Sum(race => race.PurseAmount),
                    Races = r.Races.Select(race => new RaceResponseDto
                    {
                        RaceId = race.RaceId,
                        RoundId = race.RoundId,
                        RaceNumber = race.RaceNumber,
                        ScheduledTime = race.ScheduledTime,
                        PurseAmount = race.PurseAmount,
                        TrackTypeOverride = race.TrackTypeOverride,
                        RaceDistanceOverride = race.RaceDistanceOverride,
                        Status = race.Status,
                        ConfirmationCutoffHours = race.ConfirmationCutoffHours,
                        ProtestDeadlineMinutes = race.ProtestDeadlineMinutes,
                    }).ToList(),
                }).ToList(),
                PrizeDistributions = t.PrizeDistributions
                    .OrderBy(p => p.Position)
                    .Select(p => new PrizeDistributionResponseDto
                    {
                        Position = p.Position,
                        Percentage = p.Percentage
                    }).ToList()
            };
        }

        public async Task<TournamentResponseDto> CreateTournamentAsync(CreateTournamentDto dto, int createdByUserId)
        {
            // 1. Validate enum values
            if (!ValidBreeds.Contains(dto.AllowedBreed))
                throw new ArgumentException($"Giống ngựa cho phép không hợp lệ: {dto.AllowedBreed}");
            if (!ValidTrackType.Contains(dto.TrackType))
                throw new ArgumentException($"Loại đường đua không hợp lệ: {dto.TrackType}");
            if (!ValidCategories.Contains(dto.RaceCategory))
                throw new ArgumentException($"Hạng đua không hợp lệ: {dto.RaceCategory}");
            ValidateRaceDistance(dto.RaceDistance, nameof(dto.RaceDistance));
            if (dto.AdvancementRule != null && !ValidAdvancementRules.Contains(dto.AdvancementRule))
                throw new ArgumentException($"Quy tắc đi tiếp '{dto.AdvancementRule}' chưa hỗ trợ ở phiên bản này (chỉ hỗ trợ TopPerRace).");
            if (dto.AdvancementCount.HasValue && dto.AdvancementCount.Value <= 0)
                throw new ArgumentException("Số suất đi tiếp (AdvancementCount) phải lớn hơn 0");

            // 2. Validate date range and numeric constraints
            // Giai moi khong duoc bat dau trong qua khu (cho phep ngay hom nay UTC).
            if (dto.StartDate < DateTime.UtcNow.Date)
                throw new ArgumentException("Ngày bắt đầu không được ở quá khứ.");
            ValidateTournamentWindow(dto.StartDate, dto.EndDate);
            ValidateTournamentNumbers(
                dto.MaxHorses,
                dto.MinJockeyExperienceYears,
                dto.PurseAmount,
                dto.EntryFeeAmount,
                dto.PreRaceWeightThresholdKg,
                dto.PostRaceWeightDiffThresholdKg);

            // 3. Tạo entity — Status luôn là "Draft" khi mới tạo
            var tournament = new Tournament
            {
                Name = dto.Name,
                Description = dto.Description,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                MaxHorses = dto.MaxHorses,
                AllowedBreed = dto.AllowedBreed,
                TrackType = dto.TrackType,
                RaceDistance = dto.RaceDistance,
                RaceCategory = dto.RaceCategory,
                MinJockeyExperienceYears = dto.MinJockeyExperienceYears,
                PurseAmount = dto.PurseAmount,
                EntryFeeAmount = dto.EntryFeeAmount,
                PreRaceWeightThresholdKg = dto.PreRaceWeightThresholdKg,
                PostRaceWeightDiffThresholdKg = dto.PostRaceWeightDiffThresholdKg,
                // Khong truyen -> giu default entity (TopPerRace / 5).
                AdvancementRule = dto.AdvancementRule ?? "TopPerRace",
                AdvancementCount = dto.AdvancementCount ?? 5,
                Status = "Draft",
                CreatedBy = createdByUserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Tournaments.Add(tournament);
            await _context.SaveChangesAsync();

            // 4. Ghi AuditLog
            await _auditLog.LogAsync(
                actorId: createdByUserId,
                action: "Create_Tournament",
                entityName: "Tournament",
                entityId: tournament.TournamentId.ToString(),
                newValue: tournament.Name
            );

            return MapToResponseDto(tournament);
        }

        public async Task<TournamentResponseDto?> GetTournamentByIdAsync(int tournamentId)
        {
            var tournament = await _context.Tournaments
                .Include(t => t.Rounds)
                    .ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId);

            return tournament == null ? null : MapToResponseDto(tournament);
        }

        public async Task<List<TournamentResponseDto>> GetAllTournamentsAsync()
        {
            var tournaments = await _context.Tournaments
                .Include(t => t.Rounds)
                    .ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return tournaments.Select(MapToResponseDto).ToList();
        }

        public async Task<TournamentResponseDto> UpdateTournamentAsync(int tournamentId, UpdateTournamentDto dto, int adminUserId)
        {
            var tournament = await _context.Tournaments
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId)
                ?? throw new KeyNotFoundException($"Không tìm thấy giải #{tournamentId}.");

            // Chỉ cho sửa khi còn ở Draft hoặc Open Registration
            if (tournament.Status != "Draft" && tournament.Status != "Open Registration")
                throw new InvalidOperationException(
                    "Chỉ có thể chỉnh sửa thông tin giải đấu khi giải đang ở giai đoạn nháp hoặc chưa đóng đăng ký.");

            // Field-lock khi giải đang Open Registration (TRN.9.1): enrollment screening
            // (AllowedBreed), fee flow (EntryFeeAmount), pairing validation
            // (MinJockeyExperienceYears) và cấu hình đường đua đã có dữ liệu phụ thuộc.
            // Draft vẫn chỉnh sửa tự do. Gửi lại đúng giá trị hiện tại không tính là sửa.
            if (tournament.Status == "Open Registration")
            {
                var lockedChanges = new List<string>();
                if (dto.AllowedBreed != null && dto.AllowedBreed != tournament.AllowedBreed)
                    lockedChanges.Add("AllowedBreed");
                if (dto.EntryFeeAmount.HasValue && dto.EntryFeeAmount.Value != tournament.EntryFeeAmount)
                    lockedChanges.Add("EntryFeeAmount");
                if (dto.MinJockeyExperienceYears.HasValue && dto.MinJockeyExperienceYears.Value != tournament.MinJockeyExperienceYears)
                    lockedChanges.Add("MinJockeyExperienceYears");
                if (dto.RaceDistance.HasValue && dto.RaceDistance.Value != tournament.RaceDistance)
                    lockedChanges.Add("RaceDistance");
                if (dto.TrackType != null && dto.TrackType != tournament.TrackType)
                    lockedChanges.Add("TrackType");
                if (dto.RaceCategory != null && dto.RaceCategory != tournament.RaceCategory)
                    lockedChanges.Add("RaceCategory");

                if (lockedChanges.Count > 0)
                    throw new InvalidOperationException(
                        $"FIELD_LOCKED_OPEN_REGISTRATION: Không thể sửa {string.Join(", ", lockedChanges)} " +
                        "khi giải đang mở đăng ký — hồ sơ/enrollment đã được xét theo các giá trị này.");
            }

            // StartDate khóa khi giải đã có vòng đấu (lịch vòng/race đã neo theo ngày cũ).
            if (dto.StartDate.HasValue && dto.StartDate.Value != tournament.StartDate && tournament.Rounds.Count > 0)
                throw new InvalidOperationException(
                    "Không thể sửa ngày bắt đầu khi giải đã có vòng đấu. Hãy điều chỉnh cấu trúc vòng trước.");

            // MaxHorses là trần entry hợp lệ MỖI cuộc đua (SCH.7): cho tăng tự do;
            // chỉ cho giảm nếu không tụt dưới số entry active lớn nhất đang có.
            if (dto.MaxHorses.HasValue && dto.MaxHorses.Value < tournament.MaxHorses)
            {
                var maxActiveEntries = await _context.RaceEntries
                    .Where(e => e.Race.Round.TournamentId == tournamentId &&
                                (e.Status == "Pending" || e.Status == "Confirmed"))
                    .GroupBy(e => e.RaceId)
                    .Select(g => g.Count())
                    .OrderByDescending(c => c)
                    .FirstOrDefaultAsync();

                if (dto.MaxHorses.Value < maxActiveEntries)
                    throw new InvalidOperationException(
                        $"Không thể giảm số ngựa tối đa xuống {dto.MaxHorses.Value}: " +
                        $"đang có cuộc đua với {maxActiveEntries} ngựa hợp lệ.");
            }

            // Bug 9 fix — validate enum khi update
            if (dto.AllowedBreed != null && !ValidBreeds.Contains(dto.AllowedBreed))
                throw new ArgumentException($"Giống ngựa cho phép không hợp lệ: {dto.AllowedBreed}");
            if (dto.TrackType != null && !ValidTrackType.Contains(dto.TrackType))
                throw new ArgumentException($"Loại đường đua không hợp lệ: {dto.TrackType}");
            if (dto.RaceCategory != null && !ValidCategories.Contains(dto.RaceCategory))
                throw new ArgumentException($"Hạng đua không hợp lệ: {dto.RaceCategory}");
            if (dto.RaceDistance.HasValue)
                ValidateRaceDistance(dto.RaceDistance.Value, nameof(dto.RaceDistance));
            if (dto.AdvancementRule != null && !ValidAdvancementRules.Contains(dto.AdvancementRule))
                throw new ArgumentException($"Quy tắc đi tiếp '{dto.AdvancementRule}' chưa hỗ trợ ở phiên bản này (chỉ hỗ trợ TopPerRace).");
            if (dto.AdvancementCount.HasValue && dto.AdvancementCount.Value <= 0)
                throw new ArgumentException("Số suất đi tiếp (AdvancementCount) phải lớn hơn 0");

            // Progression config chỉ được sửa trước khi tính đi tiếp: chặn nếu giải đã có
            // race Official (progression có thể đã chạy). Guard Status ở trên đã chặn sau
            // Closed Registration; đây là guard bổ sung cho trường hợp race Official sớm.
            var changingAdvancement = dto.AdvancementRule != null || dto.AdvancementCount.HasValue;
            if (changingAdvancement)
            {
                var hasOfficialRace = tournament.Rounds
                    .SelectMany(r => r.Races)
                    .Any(race => race.Status == "Official");
                if (hasOfficialRace)
                    throw new InvalidOperationException(
                        "Không thể sửa cấu hình đi tiếp khi giải đã có cuộc đua ở trạng thái Official");
            }

            var mergedStartDate = dto.StartDate ?? tournament.StartDate;
            var mergedEndDate = dto.EndDate ?? tournament.EndDate;
            var mergedMaxHorses = dto.MaxHorses ?? tournament.MaxHorses;
            var mergedMinJockeyExperienceYears = dto.MinJockeyExperienceYears ?? tournament.MinJockeyExperienceYears;
            var mergedPurseAmount = dto.PurseAmount ?? tournament.PurseAmount;
            var mergedEntryFeeAmount = dto.EntryFeeAmount ?? tournament.EntryFeeAmount;
            var mergedPreRaceWeightThresholdKg = dto.PreRaceWeightThresholdKg ?? tournament.PreRaceWeightThresholdKg;
            var mergedPostRaceWeightDiffThresholdKg = dto.PostRaceWeightDiffThresholdKg ?? tournament.PostRaceWeightDiffThresholdKg;

            ValidateTournamentWindow(mergedStartDate, mergedEndDate);
            ValidateTournamentNumbers(
                mergedMaxHorses,
                mergedMinJockeyExperienceYears,
                mergedPurseAmount,
                mergedEntryFeeAmount,
                mergedPreRaceWeightThresholdKg,
                mergedPostRaceWeightDiffThresholdKg);

            // Chỉ update field nào được gửi lên (nullable pattern); gom field đổi thật
            // sự để ghi audit Update_Tournament (TRN.9.2 — "thay đổi được ghi nhận").
            var changes = new List<string>();
            void Apply<T>(string field, T oldValue, T newValue, Action assign, bool logValues = true)
            {
                if (EqualityComparer<T>.Default.Equals(oldValue, newValue)) return;
                assign();
                changes.Add(logValues ? $"{field}: {oldValue} -> {newValue}" : $"{field}: (đã thay đổi)");
            }

            if (dto.Name != null) Apply("Name", tournament.Name, dto.Name, () => tournament.Name = dto.Name);
            if (dto.Description != null) Apply("Description", tournament.Description, dto.Description,
                () => tournament.Description = dto.Description, logValues: false);
            if (dto.StartDate.HasValue) Apply("StartDate", tournament.StartDate, dto.StartDate.Value,
                () => tournament.StartDate = dto.StartDate.Value);
            if (dto.EndDate.HasValue) Apply("EndDate", tournament.EndDate, dto.EndDate.Value,
                () => tournament.EndDate = dto.EndDate.Value);
            if (dto.MaxHorses.HasValue) Apply("MaxHorses", tournament.MaxHorses, dto.MaxHorses.Value,
                () => tournament.MaxHorses = dto.MaxHorses.Value);
            if (dto.AllowedBreed != null) Apply("AllowedBreed", tournament.AllowedBreed, dto.AllowedBreed,
                () => tournament.AllowedBreed = dto.AllowedBreed);
            if (dto.TrackType != null) Apply("TrackType", tournament.TrackType, dto.TrackType,
                () => tournament.TrackType = dto.TrackType);
            if (dto.RaceDistance.HasValue) Apply("RaceDistance", tournament.RaceDistance, dto.RaceDistance.Value,
                () => tournament.RaceDistance = dto.RaceDistance.Value);
            if (dto.RaceCategory != null) Apply("RaceCategory", tournament.RaceCategory, dto.RaceCategory,
                () => tournament.RaceCategory = dto.RaceCategory);
            if (dto.MinJockeyExperienceYears.HasValue) Apply("MinJockeyExperienceYears",
                tournament.MinJockeyExperienceYears, dto.MinJockeyExperienceYears.Value,
                () => tournament.MinJockeyExperienceYears = dto.MinJockeyExperienceYears.Value);
            if (dto.PurseAmount.HasValue) Apply("PurseAmount", tournament.PurseAmount, dto.PurseAmount.Value,
                () => tournament.PurseAmount = dto.PurseAmount.Value);
            if (dto.EntryFeeAmount.HasValue) Apply("EntryFeeAmount", tournament.EntryFeeAmount, dto.EntryFeeAmount.Value,
                () => tournament.EntryFeeAmount = dto.EntryFeeAmount.Value);
            if (dto.PreRaceWeightThresholdKg.HasValue) Apply("PreRaceWeightThresholdKg",
                tournament.PreRaceWeightThresholdKg, dto.PreRaceWeightThresholdKg.Value,
                () => tournament.PreRaceWeightThresholdKg = dto.PreRaceWeightThresholdKg.Value);
            if (dto.PostRaceWeightDiffThresholdKg.HasValue) Apply("PostRaceWeightDiffThresholdKg",
                tournament.PostRaceWeightDiffThresholdKg, dto.PostRaceWeightDiffThresholdKg.Value,
                () => tournament.PostRaceWeightDiffThresholdKg = dto.PostRaceWeightDiffThresholdKg.Value);
            if (dto.AdvancementRule != null) Apply("AdvancementRule", tournament.AdvancementRule, dto.AdvancementRule,
                () => tournament.AdvancementRule = dto.AdvancementRule);
            if (dto.AdvancementCount.HasValue) Apply("AdvancementCount", tournament.AdvancementCount, dto.AdvancementCount.Value,
                () => tournament.AdvancementCount = dto.AdvancementCount.Value);

            ValidateTournamentScheduleIntegrity(tournament);

            tournament.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            if (changes.Count > 0)
            {
                await _auditLog.LogAsync(
                    actorId: adminUserId,
                    action: "Update_Tournament",
                    entityName: "Tournament",
                    entityId: tournamentId.ToString(),
                    newValue: string.Join("; ", changes));
            }

            return MapToResponseDto(tournament);
        }

        public async Task<TournamentResponseDto> ChangeStatusAsync(int tournamentId, string targetStatus, int adminUserId)
        {
            targetStatus = targetStatus?.Trim() ?? string.Empty;
            if (targetStatus.Length == 0)
                throw new InvalidOperationException("Vui lòng chọn trạng thái muốn chuyển.");

            var tournament = await _context.Tournaments
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId)
                ?? throw new KeyNotFoundException($"Không tìm thấy giải #{tournamentId}.");

            // Chặn set Tournament sang trạng thái cấp Race (Pre-Race/Live/In-Progress/...).
            if (RaceLevelStatuses.Contains(targetStatus))
            {
                throw new InvalidOperationException(
                    "Trạng thái được chọn không hợp lệ đối với giải đấu.");
            }

            // Guard: chỉ cho phép transition hợp lệ
            if (!ValidTransitions.TryGetValue(tournament.Status, out var allowedNext) || allowedNext != targetStatus)
            {
                throw new InvalidOperationException(
                    $"Không thể chuyển giải đấu từ trạng thái {StatusLabel(tournament.Status)} sang {StatusLabel(targetStatus)}.");
            }

            // Guard đặc biệt: chuyển sang Open Registration phải có PrizeDistributions
            if (targetStatus == "Open Registration" && tournament.PrizeDistributions.Count < 5)
            {
                throw new InvalidOperationException("Vui lòng thiết lập đủ 5 mức tỷ lệ trao thưởng trước khi mở đăng ký.");
            }

            // Đóng đăng ký: validate nhẹ để giải chạy được từ vòng loại tới chung kết.
            // KHÔNG áp minimum cứng theo gate capacity (không có ngưỡng
            // tối thiểu chặn cuộc đua) — chỉ chặn giải rỗng cấu trúc/không có cặp đua.
            if (targetStatus == "Closed Registration")
            {
                if (tournament.Rounds.Count == 0)
                {
                    throw new InvalidOperationException(
                        "Giải đấu chưa có vòng đấu nào. Hãy tạo cấu trúc vòng (vòng loại/chung kết) trước khi đóng đăng ký");
                }

                var confirmedPairings = await _context.Pairings
                    .CountAsync(p => p.TournamentId == tournamentId && p.Status == "Confirmed");
                if (confirmedPairings == 0)
                {
                    throw new InvalidOperationException(
                        "Chưa có cặp Ngựa–Nài nào được xác nhận. Không thể đóng đăng ký khi giải chưa có cặp thi đấu.");
                }
            }

            // Chỉ cho Completed khi MỌI Race thuộc giải đã Official hoặc Cancelled.
            if (targetStatus == "Completed")
            {
                var unfinished = tournament.Rounds
                    .SelectMany(r => r.Races)
                    .Where(race => race.Status != "Official" && race.Status != "Cancelled")
                    .ToList();
                if (unfinished.Count > 0)
                {
                    throw new InvalidOperationException(
                        "Chỉ có thể hoàn tất giải đấu sau khi tất cả cuộc đua đã có kết quả chính thức hoặc đã được hủy.");
                }
            }

            var oldStatus = tournament.Status;
            tournament.Status = targetStatus;
            tournament.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Change_Tournament_Status",
                entityName: "Tournament",
                entityId: tournamentId.ToString(),
                oldValue: oldStatus,
                newValue: targetStatus
            );

            // Notify participant khi mở/đóng đăng ký (Module O). State machine một chiều
            // nên transition không lặp lại được — retry sẽ fail ở guard trước khi tới
            // đây, không có nguy cơ gửi trùng. Chưa có participant thì bỏ qua, không lỗi.
            if (targetStatus is "Open Registration" or "Closed Registration")
            {
                var participantIds = await _context.TournamentParticipants
                    .Where(p => p.TournamentId == tournamentId)
                    .Select(p => p.UserId)
                    .Distinct()
                    .ToListAsync();

                if (participantIds.Count > 0)
                {
                    var (title, message) = targetStatus == "Open Registration"
                        ? ("Giải đấu mở đăng ký", $"Giải '{tournament.Name}' đã mở đăng ký tham gia.")
                        : ("Giải đấu đóng đăng ký", $"Giải '{tournament.Name}' đã đóng đăng ký. Ban tổ chức sẽ chốt lịch thi đấu.");

                    await _notification.SendBulkAsync(
                        participantIds, title, message,
                        type: "Both",
                        relatedEntityType: "Tournament",
                        relatedEntityId: tournamentId);
                }
            }

            return MapToResponseDto(tournament);
        }

        public async Task CancelTournamentAsync(int tournamentId, int adminUserId)
        {
            // Load đầy đủ data liên quan
            var tournament = await _context.Tournaments
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                    .ThenInclude(race => race.RaceEntries)
                        .ThenInclude(e => e.Pairing).ThenInclude(p => p.Horse)
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                    .ThenInclude(race => race.Predictions)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId)
                ?? throw new KeyNotFoundException($"Không tìm thấy giải #{tournamentId}.");

            if (tournament.Status == "Completed")
                throw new InvalidOperationException("Không thể hủy giải đã hoàn thành");

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var now = DateTime.UtcNow;
                var affectedUserIds = new HashSet<int>();

                // Bug 4 fix — capture old status trước khi thay đổi
                var oldStatus = tournament.Status;

                // 1. Hủy giải
                tournament.Status = "Cancelled";
                tournament.UpdatedAt = now;

                // 2. Xử lý từng Race trong giải
                foreach (var round in tournament.Rounds)
                    foreach (var race in round.Races)
                    {
                        race.Status = "Cancelled";
                        race.UpdatedAt = now;

                        // 3. Hủy tất cả RaceEntry
                        foreach (var entry in race.RaceEntries)
                        {
                            // Entry Paid → Refund Pending trong CÙNG transaction,
                            // kèm Notification cho Owner + AuditLog Update_Entry_Fee_Status (không phụ thuộc trí nhớ Admin).
                            if (entry.EntryFeeStatus == "Paid")
                            {
                                entry.EntryFeeStatus = "Refund Pending";

                                var ownerId = entry.Pairing.Horse.OwnerId;
                                _context.Notifications.Add(new Notification
                                {
                                    RecipientId = ownerId,
                                    Title = "Hoàn lệ phí tham gia",
                                    Message = $"Giải đấu \"{tournament.Name}\" đã bị hủy. Lệ phí của mã đăng ký {entry.RaceEntryId} đang được xử lý hoàn lại. Bạn sẽ nhận được thông báo khi quá trình hoàn tất.",
                                    Type = "In-app",
                                    IsRead = false,
                                    RelatedEntityType = "RaceEntry",
                                    RelatedEntityId = entry.RaceEntryId,
                                    SentAt = now,
                                });
                                _auditLog.LogDeferred(
                                    actorId: adminUserId,
                                    action: "Update_Entry_Fee_Status",
                                    entityName: "RaceEntry",
                                    entityId: entry.RaceEntryId.ToString(),
                                    oldValue: "Paid",
                                    newValue: "Refund Pending");
                            }

                            entry.Status = "Cancelled";
                            entry.UpdatedAt = now;
                        }

                        // 4. Hoàn điểm ảo cho Predictions đang Pending
                        foreach (var prediction in race.Predictions.Where(p => p.Status == "Pending"))
                        {
                            // Bug 2 fix — Include Wallet để tránh null reference
                            var spectator = await _context.SpectatorProfiles
                                .Include(s => s.Wallet)
                                .FirstOrDefaultAsync(s => s.SpectatorId == prediction.SpectatorId);

                            if (spectator?.Wallet != null)
                            {
                                spectator.Wallet.Balance += prediction.PointsPlaced;
                                spectator.Wallet.UpdatedAt = now;

                                // Bug 3 fix — tạo ledger entry để giữ bất biến Balance = SUM(VPT)
                                _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
                                {
                                    WalletId = spectator.Wallet.WalletId,
                                    Amount = prediction.PointsPlaced,
                                    Type = "Prediction Refund",
                                    ReferenceId = prediction.PredictionId.ToString(),
                                    CreatedAt = now,
                                });
                            }

                            prediction.Status = "Refunded";
                            affectedUserIds.Add(prediction.SpectatorId);
                        }
                    }

                // 4b. Vô hiệu các Pairing của giải: chuyển Cancelled cho pairing chưa kết thúc.
                // Schema mới expose Pairing.TournamentId nên lọc trực tiếp theo tournament.
                var pairings = await _context.Pairings
                    .Where(p => p.TournamentId == tournamentId
                                && p.Status != "Cancelled" && p.Status != "Declined")
                    .ToListAsync();
                foreach (var pairing in pairings)
                {
                    pairing.Status = "Cancelled";
                    pairing.UpdatedAt = now;
                }

                // 4c. Đưa payout liên quan về trạng thái chưa chi trả khi giải bị hủy.
                var payouts = await _context.PursePayouts
                    .Where(p => p.RaceEntry.Race.Round.TournamentId == tournamentId)
                    .ToListAsync();
                foreach (var payout in payouts)
                {
                    var oldPayoutStatus = payout.PayoutStatus;
                    var oldPaidAt = payout.PaidAt;

                    payout.PayoutStatus = "Unpaid";
                    payout.PaidAt = null;
                    payout.UpdatedByAdminId = adminUserId;
                    payout.UpdatedAt = now;

                    if (oldPayoutStatus != "Unpaid" || oldPaidAt != null)
                    {
                        _auditLog.LogDeferred(
                            actorId: adminUserId,
                            action: "Cancel_Tournament_PursePayout",
                            entityName: "PursePayout",
                            entityId: payout.PursePayoutId.ToString(),
                            oldValue: oldPayoutStatus,
                            newValue: "Unpaid");
                    }
                }

                // 5. Gửi Notification cho tất cả Spectator có dự đoán bị ảnh hưởng
                foreach (var userId in affectedUserIds)
                {
                    _context.Notifications.Add(new Notification
                    {
                        RecipientId = userId,
                        Title = "Giải đấu bị hủy",
                        Message = $"Giải đấu \"{tournament.Name}\" đã bị hủy. Điểm dự đoán liên quan của bạn đã được hoàn về ví.",
                        Type = "In-app",
                        IsRead = false,
                        RelatedEntityType = "Tournament",
                        RelatedEntityId = tournamentId,
                        SentAt = now,
                    });
                }

                await _context.SaveChangesAsync();

                // 6. Ghi AuditLog
                // Bug 4 fix — dùng oldStatus thật thay vì hardcode "Active"
                await _auditLog.LogAsync(
                    actorId: adminUserId,
                    action: "Cancel_Tournament",
                    entityName: "Tournament",
                    entityId: tournamentId.ToString(),
                    oldValue: oldStatus,
                    newValue: "Cancelled"
                );

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // Giải Completed/Cancelled là trạng thái kết thúc — khóa mọi thao tác cấu trúc
        // Round/Race (TRN.8: giải Completed không được phép còn race Upcoming mới).
        private static void EnsureTournamentStructureEditable(string tournamentStatus)
        {
            if (tournamentStatus == "Completed" || tournamentStatus == "Cancelled")
                throw new InvalidOperationException(
                    $"Giải đấu {StatusLabel(tournamentStatus)} nên không thể tạo hoặc chỉnh sửa vòng đấu và cuộc đua.");
        }

        // Nhãn trạng thái giải đấu bằng tiếng Việt cho thông báo/lỗi hiển thị cho người dùng.
        // Không thay giá trị enum lưu DB (Draft/Open Registration/...) — chỉ dùng khi render text.
        private static string StatusLabel(string status) => status switch
        {
            "Draft" => "đang ở giai đoạn nháp",
            "Open Registration" => "đang mở đăng ký",
            "Closed Registration" => "đã đóng đăng ký",
            "Completed" => "đã hoàn tất",
            "Cancelled" => "đã bị hủy",
            _ => status
        };

        public async Task<List<PrizeDistributionResponseDto>> SetPrizeDistributionsAsync(int tournamentId, SetPrizeDistributionDto dto, int adminUserId)
        {
            // Bug 6 fix — kiểm tra tournament tồn tại trước khi upsert
            var tournament = await _context.Tournaments
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId)
                ?? throw new KeyNotFoundException($"Không tìm thấy giải #{tournamentId}.");

            // Chỉ cho sửa tỷ lệ thưởng khi còn ở Draft hoặc Open Registration —
            // đồng bộ guard với UpdateTournamentAsync để tránh đổi % sau khi đã
            // đóng đăng ký (PursePayout có thể đã tính theo tỷ lệ cũ).
            if (tournament.Status != "Draft" && tournament.Status != "Open Registration")
                throw new InvalidOperationException(
                    "Chỉ có thể điều chỉnh tỷ lệ trao thưởng khi giải đấu đang ở giai đoạn nháp hoặc chưa đóng đăng ký.");

            // 1. Validate đủ 5 position không trùng
            var positions = dto.Distributions.Select(d => d.Position).OrderBy(p => p).ToList();
            if (positions.Count != 5 || !positions.SequenceEqual([1, 2, 3, 4, 5]))
                throw new ArgumentException("Phải nhập đúng 5 vị trí từ 1 đến 5, không trùng");

            // 2. Validate tổng = 100% — dùng decimal để tránh floating point error
            var total = dto.Distributions.Sum(d => d.Percentage);
            if (Math.Round(total, 2) != 100m)
                throw new ArgumentException($"Tổng tỷ lệ phải = 100%, hiện tại = {total}%");

            // 3. Upsert — xóa cũ, insert mới trong cùng transaction
            var existing = await _context.PrizeDistributions
                .Where(p => p.TournamentId == tournamentId)
                .ToListAsync();
            _context.PrizeDistributions.RemoveRange(existing);

            var newItems = dto.Distributions.Select(d => new PrizeDistribution
            {
                TournamentId = tournamentId,
                Position = d.Position,
                Percentage = d.Percentage,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            }).ToList();

            _context.PrizeDistributions.AddRange(newItems);
            await _context.SaveChangesAsync();

            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Set_Prize_Distributions",
                entityName: "Tournament",
                entityId: tournamentId.ToString(),
                newValue: string.Join("; ", newItems.OrderBy(p => p.Position)
                    .Select(p => $"Top{p.Position}={p.Percentage}%")));

            return newItems
                .OrderBy(p => p.Position)
                .Select(p => new PrizeDistributionResponseDto
                {
                    Position = p.Position,
                    Percentage = p.Percentage
                }).ToList();
        }

        public async Task<RoundResponseDto> CreateRoundAsync(int tournamentId, CreateRoundDto dto, int adminUserId)
        {
            var tournament = await _context.Tournaments.FindAsync(tournamentId)
                ?? throw new KeyNotFoundException($"Không tìm thấy giải #{tournamentId}.");

            EnsureTournamentStructureEditable(tournament.Status);

            // Validate date nằm trong cửa sổ giải
            if (dto.ScheduledDate < tournament.StartDate || dto.ScheduledDate > tournament.EndDate)
                throw new ArgumentException(
                    $"ScheduledDate phải nằm trong [{tournament.StartDate:d}, {tournament.EndDate:d}]");

            var existingRounds = await _context.Rounds
                .Include(r => r.Races)
                .Where(r => r.TournamentId == tournamentId)
                .ToListAsync();

            // Bug 7 fix — kiểm tra trùng SequenceOrder trong cùng tournament
            if (existingRounds.Any(r => r.SequenceOrder == dto.SequenceOrder))
                throw new ArgumentException($"Thứ tự vòng {dto.SequenceOrder} đã tồn tại trong giải #{tournamentId}.");

            // Validate tính liên tục thời gian giữa các vòng: vòng sau phải diễn ra
            // sau khi vòng ngay trước nó đã kết thúc (sau race cuối cùng của vòng trước).
            var previousRound = existingRounds
                .Where(r => r.SequenceOrder < dto.SequenceOrder)
                .OrderByDescending(r => r.SequenceOrder)
                .FirstOrDefault();
            if (previousRound != null)
            {
                var previousBoundary = previousRound.Races.Count > 0
                    ? previousRound.Races.Max(r => r.ScheduledTime)
                    : previousRound.ScheduledDate;

                if (dto.ScheduledDate <= previousBoundary)
                    throw new ArgumentException(
                        $"ScheduledDate phải sau {(previousRound.Races.Count > 0 ? "cuộc đua cuối" : "ngày")} của vòng trước (Round #{previousRound.RoundId}, {previousBoundary:u})");
            }

            // Vòng kế tiếp (nếu đã tồn tại) phải bắt đầu sau vòng đang tạo.
            var nextRound = existingRounds
                .Where(r => r.SequenceOrder > dto.SequenceOrder)
                .OrderBy(r => r.SequenceOrder)
                .FirstOrDefault();
            if (nextRound != null && dto.ScheduledDate >= nextRound.ScheduledDate)
                throw new ArgumentException(
                    $"ScheduledDate phải trước ngày của vòng kế tiếp (Round #{nextRound.RoundId}, {nextRound.ScheduledDate:u})");

            var round = new Round
            {
                TournamentId = tournamentId,
                Name = dto.Name,
                SequenceOrder = dto.SequenceOrder,
                ScheduledDate = dto.ScheduledDate,
                Status = "Upcoming",
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Rounds.Add(round);
            await _context.SaveChangesAsync();

            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Create_Round",
                entityName: "Round",
                entityId: round.RoundId.ToString(),
                newValue: $"Tournament={tournamentId};Sequence={dto.SequenceOrder};Name={dto.Name};ScheduledDate={dto.ScheduledDate:u}");

            return new RoundResponseDto
            {
                RoundId = round.RoundId,
                Name = round.Name,
                SequenceOrder = round.SequenceOrder,
                ScheduledDate = round.ScheduledDate,
                Status = round.Status,
                AllocatedPurse = 0,
                Races = []
            };
        }

        public async Task<RaceResponseDto> CreateRaceAsync(int roundId, CreateRaceDto dto, int adminUserId)
        {
            // Load Round kèm Tournament để validate
            var round = await _context.Rounds
                .Include(r => r.Tournament)
                .FirstOrDefaultAsync(r => r.RoundId == roundId)
                ?? throw new KeyNotFoundException($"Không tìm thấy vòng #{roundId}.");

            var tournament = round.Tournament;
            EnsureTournamentStructureEditable(tournament.Status);
            ValidateRaceDistanceOverride(dto.RaceDistanceOverride);

            // Validate thời gian
            if (dto.ScheduledTime <= DateTime.UtcNow)
                throw new ArgumentException("Thời gian thi đấu phải ở tương lai.");

            if (dto.ScheduledTime < tournament.StartDate || dto.ScheduledTime > tournament.EndDate)
                throw new ArgumentException(
                    $"Thời gian thi đấu phải nằm trong thời gian diễn ra giải ({tournament.StartDate:d} - {tournament.EndDate:d}).");

            // Bug 8 fix — kiểm tra trùng RaceNumber trong cùng round
            if (dto.ScheduledTime < round.ScheduledDate)
                throw new ArgumentException("Thời gian thi đấu không được sớm hơn ngày của vòng.");

            var isDuplicateRaceNumber = await _context.Races
                .AnyAsync(r => r.RoundId == roundId && r.RaceNumber == dto.RaceNumber);
            if (isDuplicateRaceNumber)
                throw new ArgumentException($"Số cuộc đua {dto.RaceNumber} đã tồn tại trong vòng #{roundId}.");

            // Validate tổng PurseAmount không vượt giải
            var existingPurseTotal = await _context.Races
                .Where(r => r.Round.TournamentId == tournament.TournamentId)
                .SumAsync(r => r.PurseAmount);

            if (existingPurseTotal + dto.PurseAmount > tournament.PurseAmount)
                throw new ArgumentException(
                    $"Tổng giải thưởng các cuộc đua ({existingPurseTotal + dto.PurseAmount}) vượt quá tổng giải thưởng của giải ({tournament.PurseAmount}).");

            var race = new Race
            {
                RoundId = roundId,
                RaceNumber = dto.RaceNumber,
                ScheduledTime = dto.ScheduledTime,
                PurseAmount = dto.PurseAmount,
                TrackTypeOverride = dto.TrackTypeOverride,
                RaceDistanceOverride = dto.RaceDistanceOverride,
                Status = "Upcoming",
                IsPostPositionDrawn = false,
                IsPredictionGateClosed = false,
                ConfirmationCutoffHours = dto.ConfirmationCutoffHours,
                ProtestDeadlineMinutes = dto.ProtestDeadlineMinutes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Races.Add(race);
            await _context.SaveChangesAsync();

            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Create_Race",
                entityName: "Race",
                entityId: race.RaceId.ToString(),
                newValue: $"Round={roundId};RaceNumber={dto.RaceNumber};ScheduledTime={dto.ScheduledTime:u};Purse={dto.PurseAmount}");

            return new RaceResponseDto
            {
                RaceId = race.RaceId,
                RoundId = race.RoundId,
                RaceNumber = race.RaceNumber,
                ScheduledTime = race.ScheduledTime,
                PurseAmount = race.PurseAmount,
                TrackTypeOverride = race.TrackTypeOverride,
                RaceDistanceOverride = race.RaceDistanceOverride,
                Status = race.Status,
                ConfirmationCutoffHours = race.ConfirmationCutoffHours,
                ProtestDeadlineMinutes = race.ProtestDeadlineMinutes,
            };
        }

        // Cập nhật cấu hình Race, đóng băng trường nhạy cảm sau cam kết.
        public async Task<RaceResponseDto> UpdateRaceAsync(int raceId, UpdateRaceDto dto, int adminUserId)
        {
            var race = await _context.Races
                .Include(r => r.Round).ThenInclude(rd => rd.Tournament)
                .FirstOrDefaultAsync(r => r.RaceId == raceId)
                ?? throw new KeyNotFoundException($"Không tìm thấy cuộc đua #{raceId}.");

            var tournament = race.Round.Tournament;
            EnsureTournamentStructureEditable(tournament.Status);
            ValidateRaceDistanceOverride(dto.RaceDistanceOverride);

            // Chỉ các trường nhạy cảm mới bị đóng băng sau khi bốc thăm hoặc đã có Prediction.
            // Cho phép sửa các trường không nhạy cảm (PurseAmount, cutoff...) ngay cả khi đã đóng băng.
            var sensitiveChanged =
                race.ScheduledTime != dto.ScheduledTime ||
                race.RaceDistanceOverride != dto.RaceDistanceOverride ||
                race.TrackTypeOverride != dto.TrackTypeOverride;

            // Dung guard chung cua Module E thay vi viet lai logic freeze inline (throw RACE_CONFIG_FROZEN).
            if (sensitiveChanged)
                await _raceEntry.EnsureRaceConfigEditableAsync(raceId);

            // Validate cửa sổ thời gian (chỉ khi ScheduledTime thay đổi).
            if (race.ScheduledTime != dto.ScheduledTime)
            {
                if (dto.ScheduledTime <= DateTime.UtcNow)
                    throw new ArgumentException("Thời gian thi đấu phải ở tương lai.");

                if (dto.ScheduledTime < tournament.StartDate || dto.ScheduledTime > tournament.EndDate)
                    throw new ArgumentException(
                        $"Thời gian thi đấu phải nằm trong thời gian diễn ra giải ({tournament.StartDate:d} - {tournament.EndDate:d}).");

                if (dto.ScheduledTime < race.Round.ScheduledDate)
                    throw new ArgumentException("Thời gian thi đấu không được sớm hơn ngày của vòng.");
            }

            // Tổng PurseAmount không vượt quỹ giải (trừ chính race này).
            if (race.PurseAmount != dto.PurseAmount)
            {
                var otherPurseTotal = await _context.Races
                    .Where(r => r.Round.TournamentId == tournament.TournamentId && r.RaceId != raceId)
                    .SumAsync(r => r.PurseAmount);

                if (otherPurseTotal + dto.PurseAmount > tournament.PurseAmount)
                    throw new ArgumentException(
                        $"Tổng giải thưởng các cuộc đua ({otherPurseTotal + dto.PurseAmount}) vượt quá tổng giải thưởng của giải ({tournament.PurseAmount}).");
            }

            var raceChanges = new List<string>();
            void TrackRaceChange<T>(string field, T oldValue, T newValue)
            {
                if (!EqualityComparer<T>.Default.Equals(oldValue, newValue))
                    raceChanges.Add($"{field}: {oldValue} -> {newValue}");
            }
            TrackRaceChange("ScheduledTime", race.ScheduledTime, dto.ScheduledTime);
            TrackRaceChange("PurseAmount", race.PurseAmount, dto.PurseAmount);
            TrackRaceChange("TrackTypeOverride", race.TrackTypeOverride, dto.TrackTypeOverride);
            TrackRaceChange("RaceDistanceOverride", race.RaceDistanceOverride, dto.RaceDistanceOverride);
            TrackRaceChange("ConfirmationCutoffHours", race.ConfirmationCutoffHours, dto.ConfirmationCutoffHours);
            TrackRaceChange("ProtestDeadlineMinutes", race.ProtestDeadlineMinutes, dto.ProtestDeadlineMinutes);

            race.ScheduledTime = dto.ScheduledTime;
            race.PurseAmount = dto.PurseAmount;
            race.TrackTypeOverride = dto.TrackTypeOverride;
            race.RaceDistanceOverride = dto.RaceDistanceOverride;
            race.ConfirmationCutoffHours = dto.ConfirmationCutoffHours;
            race.ProtestDeadlineMinutes = dto.ProtestDeadlineMinutes;
            race.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            if (raceChanges.Count > 0)
            {
                await _auditLog.LogAsync(
                    actorId: adminUserId,
                    action: "Update_Race",
                    entityName: "Race",
                    entityId: raceId.ToString(),
                    newValue: string.Join("; ", raceChanges));
            }

            return new RaceResponseDto
            {
                RaceId = race.RaceId,
                RoundId = race.RoundId,
                RaceNumber = race.RaceNumber,
                ScheduledTime = race.ScheduledTime,
                PurseAmount = race.PurseAmount,
                TrackTypeOverride = race.TrackTypeOverride,
                RaceDistanceOverride = race.RaceDistanceOverride,
                Status = race.Status,
                ConfirmationCutoffHours = race.ConfirmationCutoffHours,
                ProtestDeadlineMinutes = race.ProtestDeadlineMinutes,
            };
        }
    }
}
