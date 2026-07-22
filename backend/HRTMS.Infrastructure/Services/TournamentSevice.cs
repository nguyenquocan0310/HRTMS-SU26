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
            ["Draft"] = "Open Registration",
            ["Open Registration"] = "Closed Registration",
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

        // Buffer bắt buộc giữa hạn nộp lệ phí và ngày khai mạc: sau PaymentDeadline
        // hệ thống còn phải auto-allocate rồi auto-draw (AutoDrawJob chạy khi race
        // còn <= 24h). Deadline sát StartDate thì draw không kịp.
        private static readonly TimeSpan PaymentDeadlineBuffer = TimeSpan.FromHours(24);

        // Deadline lệ phí (patch 012) — rule dùng chung cho Create/Update.
        //   PaymentDeadline : BẮT BUỘC mọi giải (giải free = hạn chốt đăng ký,
        //                     vì AutoAllocateJob lấy mốc này làm trigger).
        //                     now < PaymentDeadline <= StartDate - 24h.
        //   RefundDeadline  : chỉ khi EntryFeeAmount > 0; Admin KHÔNG phải nhập —
        //                     mặc định suy ra từ StartDate (xem DeriveRefundDeadline).
        //                     Nhập tay được, phải nằm trong [PaymentDeadline, StartDate].
        //
        // enforceFutureDeadline = false khi Update mà Admin KHÔNG đổi PaymentDeadline:
        // giải cũ có deadline đã trôi qua vẫn phải sửa được field khác.
        private static void ValidateDeadlines(
            DateTime? paymentDeadline,
            DateTime? refundDeadline,
            DateTime startDate,
            decimal entryFeeAmount,
            bool enforceFutureDeadline)
        {
            if (!paymentDeadline.HasValue)
                throw new InvalidOperationException("PAYMENT_DEADLINE_REQUIRED");

            var pd = paymentDeadline.Value;

            if (enforceFutureDeadline && pd <= DateTime.UtcNow)
                throw new InvalidOperationException("PAYMENT_DEADLINE_OUT_OF_RANGE");

            if (pd > startDate - PaymentDeadlineBuffer)
                throw new InvalidOperationException("PAYMENT_DEADLINE_OUT_OF_RANGE");

            if (!refundDeadline.HasValue)
                return;

            // Giải miễn phí thì không có gì để hoàn — đặt hạn hoàn phí là vô nghĩa.
            if (entryFeeAmount <= 0)
                throw new InvalidOperationException("REFUND_DEADLINE_INVALID");

            var rd = refundDeadline.Value;

            // Cửa sổ hoàn phí đóng trước hạn đóng tiền là vô nghĩa: người nộp đúng
            // hạn chót sẽ không bao giờ có cửa rút.
            if (rd < pd || rd > startDate)
                throw new InvalidOperationException("REFUND_DEADLINE_INVALID");
        }

        // Hạn hoàn phí mặc định: neo vào NGÀY ĐUA, không phải ngày nộp tiền.
        //
        // Chi phí tổ chức phát sinh theo ngày đua (chốt field, bốc thăm, mở dự đoán),
        // nên cửa sổ hoàn phí phải đóng theo mốc đó. Neo vào PaymentDeadline + N ngày
        // thì mốc trôi theo lựa chọn hành chính: mở đóng phí sớm 30 ngày sẽ cắt quyền
        // rút từ rất lâu trước khi giải tốn gì; chốt phí sát ngày đua lại đẩy hạn hoàn
        // phí ra sau khi đã đua xong.
        //
        // StartDate - 24h trùng đúng mốc AutoDrawJob bốc thăm, nên rule phát biểu gọn:
        // "rút trước khi bốc thăm thì được hoàn, bốc thăm xong là scratch".
        // Clamp về PaymentDeadline cho giải mở đăng ký sát ngày đua (hạn nộp có thể
        // muộn hơn StartDate - 24h là không hợp lệ, nhưng bằng thì hợp lệ).
        private static DateTime DeriveRefundDeadline(DateTime paymentDeadline, DateTime startDate)
        {
            var derived = startDate - PaymentDeadlineBuffer;
            return derived < paymentDeadline ? paymentDeadline : derived;
        }

        // Sân đua (patch 011) — nạp venue và kiểm tra mọi ràng buộc dùng chung cho
        // Create/Update. Trả về venue để caller lấy TrackType/LaneCount.
        // maxHorses là giá trị SAU merge (giá trị giải sẽ có sau thao tác này).
        private async Task<Venue> LoadAndValidateVenueAsync(int venueId, int maxHorses)
        {
            var venue = await _context.Venues.FirstOrDefaultAsync(v => v.VenueId == venueId)
                ?? throw new KeyNotFoundException("VENUE_NOT_FOUND");

            // Sân chưa/không còn hoạt động không được gán cho giải mới.
            if (!venue.IsActive)
                throw new InvalidOperationException("VENUE_INACTIVE");

            // Số cổng xuất phát là trần cứng: không thể xếp nhiều ngựa hơn số làn.
            if (maxHorses > venue.LaneCount)
                throw new InvalidOperationException("MAX_HORSES_EXCEEDS_LANES");

            return venue;
        }

        private static TournamentResponseDto MapToResponseDto(Tournament t)
        {
            var allocatedPurse = t.Rounds.SelectMany(r => r.Races).Sum(race => race.PurseAmount);

            return new TournamentResponseDto
            {
                VenueId = t.VenueId,
                VenueName = t.Venue?.Name,
                VenueCity = t.Venue?.City,
                LaneCount = t.Venue?.LaneCount,
                TrackLengthMeters = t.Venue?.TrackLengthMeters,
                RaceCapacity = t.Venue == null ? null : Math.Min(t.MaxHorses, t.Venue.LaneCount),
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
                PaymentDeadline = t.PaymentDeadline,
                RefundDeadline = t.RefundDeadline,
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
                        IsPostPositionDrawn = race.IsPostPositionDrawn,
                        ConfirmationCutoffHours = race.ConfirmationCutoffHours,
                        ProtestDeadlineMinutes = race.ProtestDeadlineMinutes,
                        // Sân đua kế thừa từ giải (patch 011).
                        VenueName = t.Venue?.Name,
                        VenueCity = t.Venue?.City,
                        VenueTrackType = t.Venue?.TrackType,
                        LaneCount = t.Venue?.LaneCount,
                        TrackLengthMeters = t.Venue?.TrackLengthMeters,
                        RaceCapacity = t.Venue == null ? null : Math.Min(t.MaxHorses, t.Venue.LaneCount),
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

            // Deadline lệ phí (patch 012) — bắt buộc cho giải mới.
            // Không gửi RefundDeadline thì giải thu phí vẫn có chính sách hoàn phí
            // mặc định; giải miễn phí không có gì để hoàn nên để NULL.
            var refundDeadline = dto.RefundDeadline
                ?? (dto.EntryFeeAmount > 0
                    ? DeriveRefundDeadline(dto.PaymentDeadline, dto.StartDate)
                    : (DateTime?)null);

            ValidateDeadlines(
                dto.PaymentDeadline, refundDeadline,
                dto.StartDate, dto.EntryFeeAmount,
                enforceFutureDeadline: true);

            // Sân đua (patch 011) — bắt buộc cho giải mới, phải active, và MaxHorses
            // không được vượt số làn của sân.
            var venue = await LoadAndValidateVenueAsync(dto.VenueId, dto.MaxHorses);

            // TrackType của giải LẤY TỪ SÂN. Nếu client gửi giá trị khác thì báo lỗi
            // thay vì ghi đè im lặng — tránh Admin tưởng đã đặt Turf trên sân Dirt.
            if (dto.TrackType != venue.TrackType)
                throw new InvalidOperationException("TRACK_TYPE_VENUE_MISMATCH");
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
                // Suy ra từ sân — không nhận trực tiếp từ client (đã validate khớp ở trên).
                TrackType = venue.TrackType,
                VenueId = venue.VenueId,
                RaceDistance = dto.RaceDistance,
                RaceCategory = dto.RaceCategory,
                MinJockeyExperienceYears = dto.MinJockeyExperienceYears,
                PurseAmount = dto.PurseAmount,
                EntryFeeAmount = dto.EntryFeeAmount,
                PaymentDeadline = dto.PaymentDeadline,
                RefundDeadline = refundDeadline,
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

            // Gán nav đã nạp sẵn để MapToResponseDto trả về thông tin sân ngay,
            // không phải query lại.
            tournament.Venue = venue;

            // 4. Ghi AuditLog
            await _auditLog.LogAsync(
                actorId: createdByUserId,
                action: "Tạo giải đấu mới",
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
                .Include(t => t.Venue)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId);

            return tournament == null ? null : MapToResponseDto(tournament);
        }

        public async Task<List<TournamentResponseDto>> GetAllTournamentsAsync()
        {
            var tournaments = await _context.Tournaments
                .Include(t => t.Rounds)
                    .ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .Include(t => t.Venue)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return tournaments.Select(MapToResponseDto).ToList();
        }

        public async Task<TournamentResponseDto> UpdateTournamentAsync(int tournamentId, UpdateTournamentDto dto, int adminUserId)
        {
            var tournament = await _context.Tournaments
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .Include(t => t.Venue)
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
                // Sân quyết định số làn (sức chứa) và TrackType — enrollment đã được
                // xét theo các giá trị này nên không cho đổi sân giữa kỳ đăng ký.
                if (dto.VenueId.HasValue && dto.VenueId.Value != tournament.VenueId)
                    lockedChanges.Add("VenueId");

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
                var hasAdvancementResult = await _context.RaceEntries.AnyAsync(entry =>
                    entry.Race.Round.TournamentId == tournamentId &&
                    entry.AdvancementStatus != null);
                if (hasOfficialRace || hasAdvancementResult)
                    throw new InvalidOperationException("ADVANCEMENT_CONFIGURATION_LOCKED");
            }

            var mergedStartDate = dto.StartDate ?? tournament.StartDate;
            var mergedEndDate = dto.EndDate ?? tournament.EndDate;
            var mergedMaxHorses = dto.MaxHorses ?? tournament.MaxHorses;

            // Sân đua (patch 011). Rule mới bắt buộc VenueId cho MỌI lần cập nhật:
            // giải cũ (VenueId NULL) vẫn ĐỌC được bình thường, nhưng muốn sửa thì
            // phải gán sân. Validate chạy khi đổi sân HOẶC khi đổi MaxHorses
            // (MaxHorses mới có thể vượt số làn của sân hiện tại).
            var mergedVenueId = dto.VenueId ?? tournament.VenueId
                ?? throw new InvalidOperationException("VENUE_REQUIRED");

            Venue? mergedVenue = tournament.Venue;
            if (mergedVenueId != tournament.VenueId || dto.MaxHorses.HasValue)
            {
                mergedVenue = await LoadAndValidateVenueAsync(mergedVenueId, mergedMaxHorses);
            }

            // TrackType luôn suy ra từ sân; client gửi giá trị mâu thuẫn thì báo lỗi.
            if (mergedVenue != null && dto.TrackType != null && dto.TrackType != mergedVenue.TrackType)
                throw new InvalidOperationException("TRACK_TYPE_VENUE_MISMATCH");

            // ─── Deadline lệ phí (patch 012) ────────────────────────────────
            var mergedEntryFeeAmount = dto.EntryFeeAmount ?? tournament.EntryFeeAmount;
            var mergedPaymentDeadline = dto.PaymentDeadline ?? tournament.PaymentDeadline;
            var mergedRefundDeadline = dto.ClearRefundDeadline
                ? null
                : dto.RefundDeadline ?? tournament.RefundDeadline;

            // Giải miễn phí chuyển sang thu phí thì mới sinh hạn hoàn phí mặc định:
            // lúc đó giải chưa từng có chính sách hoàn phí để mà tôn trọng.
            //
            // KHÔNG suy lại trong các trường hợp khác. RefundDeadline đã lưu là mốc
            // Owner nhìn thấy trước khi quyết định nộp tiền — dời StartDate mà tự tính
            // lại sẽ âm thầm rút ngắn quyền rút của người đã đóng phí. Muốn đổi thì
            // Admin gửi RefundDeadline mới (có audit), muốn bỏ hoàn phí thì gửi
            // ClearRefundDeadline (và giá trị NULL đó phải giữ nguyên qua các lần sửa sau).
            if (mergedRefundDeadline == null &&
                !dto.ClearRefundDeadline &&
                mergedEntryFeeAmount > 0 &&
                tournament.EntryFeeAmount <= 0 &&
                mergedPaymentDeadline.HasValue)
            {
                mergedRefundDeadline = DeriveRefundDeadline(
                    mergedPaymentDeadline.Value, mergedStartDate);
            }

            var changingDeadline =
                (dto.PaymentDeadline.HasValue && dto.PaymentDeadline != tournament.PaymentDeadline) ||
                (dto.RefundDeadline.HasValue && dto.RefundDeadline != tournament.RefundDeadline) ||
                (dto.ClearRefundDeadline && tournament.RefundDeadline != null);

            // Đã qua hạn nộp lệ phí nghĩa là FeeDeadlineJob đã chạy (pairing trễ đã
            // bị Declined) và AutoAllocateJob đã lấy mốc này làm trigger. Dời deadline
            // sau thời điểm đó sẽ mâu thuẫn với dữ liệu job vừa ghi.
            if (changingDeadline &&
                tournament.PaymentDeadline.HasValue &&
                DateTime.UtcNow > tournament.PaymentDeadline.Value)
            {
                throw new InvalidOperationException("DEADLINE_LOCKED");
            }

            var mergedMinJockeyExperienceYears = dto.MinJockeyExperienceYears ?? tournament.MinJockeyExperienceYears;
            var mergedPurseAmount = dto.PurseAmount ?? tournament.PurseAmount;
            var mergedPreRaceWeightThresholdKg = dto.PreRaceWeightThresholdKg ?? tournament.PreRaceWeightThresholdKg;
            var mergedPostRaceWeightDiffThresholdKg = dto.PostRaceWeightDiffThresholdKg ?? tournament.PostRaceWeightDiffThresholdKg;

            // Chạy sau khi có mergedEntryFeeAmount: rule RefundDeadline phụ thuộc
            // việc giải có thu phí hay không.
            ValidateDeadlines(
                mergedPaymentDeadline, mergedRefundDeadline,
                mergedStartDate, mergedEntryFeeAmount,
                // Chỉ bắt "deadline phải ở tương lai" khi Admin THỰC SỰ đổi mốc —
                // giải cũ có deadline đã trôi qua vẫn phải sửa được field khác.
                enforceFutureDeadline: dto.PaymentDeadline.HasValue &&
                                       dto.PaymentDeadline != tournament.PaymentDeadline);

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
            // Sân + TrackType đi cùng nhau: đổi sân kéo theo TrackType của sân mới.
            if (mergedVenue != null)
            {
                Apply("VenueId", tournament.VenueId, (int?)mergedVenue.VenueId,
                    () => { tournament.VenueId = mergedVenue.VenueId; tournament.Venue = mergedVenue; });
                Apply("TrackType", tournament.TrackType, mergedVenue.TrackType,
                    () => tournament.TrackType = mergedVenue.TrackType);
            }
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
            Apply("PaymentDeadline", tournament.PaymentDeadline, mergedPaymentDeadline,
                () => tournament.PaymentDeadline = mergedPaymentDeadline);
            Apply("RefundDeadline", tournament.RefundDeadline, mergedRefundDeadline,
                () => tournament.RefundDeadline = mergedRefundDeadline);
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
                    action: "Cập nhật thông tin giải đấu",
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
                action: "Đổi trạng thái giải đấu",
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
            var affectedUserIds = new HashSet<int>();
            var refundNotifications = new List<(int RecipientId, string Title, string Message, int RaceEntryId)>();
            try
            {
                var now = DateTime.UtcNow;

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
                                refundNotifications.Add((
                                    ownerId,
                                    "Hoàn lệ phí tham gia",
                                    $"Giải đấu \"{tournament.Name}\" đã bị hủy. Lệ phí của mã đăng ký {entry.RaceEntryId} đang được xử lý hoàn lại. Bạn sẽ nhận được thông báo khi quá trình hoàn tất.",
                                    entry.RaceEntryId));
                                _auditLog.LogDeferred(
                                    actorId: adminUserId,
                                    action: "Cập nhật trạng thái lệ phí",
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
                            var wallet = await _context.Wallets
                                .AsNoTracking()
                                .FirstOrDefaultAsync(w => w.SpectatorId == prediction.SpectatorId);

                            if (wallet != null)
                            {
                                // FIX: ExecuteUpdateAsync cộng nguyên tử theo điều kiện WHERE thay vì
                                // đọc entity rồi += và SaveChanges — tránh lost-update nếu ví đang
                                // bị PlacePredictionAsync/redeem/EmergencyDisqualify khác thao tác
                                // đồng thời (Wallet không có RowVersion nên EF không tự phát hiện conflict).
                                await _context.Wallets
                                    .Where(w => w.SpectatorId == prediction.SpectatorId)
                                    .ExecuteUpdateAsync(s => s
                                        .SetProperty(w => w.Balance, w => w.Balance + prediction.PointsPlaced)
                                        .SetProperty(w => w.UpdatedAt, now));

                                // Bug 3 fix — tạo ledger entry để giữ bất biến Balance = SUM(VPT)
                                _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
                                {
                                    WalletId = wallet.WalletId,
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
                            action: "Hủy tiền thưởng do giải đấu bị hủy",
                            entityName: "PursePayout",
                            entityId: payout.PursePayoutId.ToString(),
                            oldValue: oldPayoutStatus,
                            newValue: "Unpaid");
                    }
                }

                // 5. Notification cho Spectator bị ảnh hưởng — gửi sau khi commit (xem dưới).

                await _context.SaveChangesAsync();

                // 6. Ghi AuditLog
                // Bug 4 fix — dùng oldStatus thật thay vì hardcode "Active"
                await _auditLog.LogAsync(
                    actorId: adminUserId,
                    action: "Hủy giải đấu",
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

            // Gửi notification SAU KHI transaction đã commit — dùng NotificationService
            // (không insert thẳng Entity) để email thực sự được dispatch, không chỉ in-app.
            // Type "Both" vì đây là sự kiện hủy giải/hoàn tiền — ảnh hưởng tài chính, cần
            // đảm bảo user thấy được kể cả khi không đang mở app.
            foreach (var (recipientId, title, message, raceEntryId) in refundNotifications)
            {
                await _notification.SendAsync(
                    recipientId, title, message,
                    type: "Both",
                    relatedEntityType: "RaceEntry",
                    relatedEntityId: raceEntryId);
            }

            if (affectedUserIds.Count > 0)
            {
                await _notification.SendBulkAsync(
                    affectedUserIds,
                    "Giải đấu bị hủy",
                    $"Giải đấu \"{tournament.Name}\" đã bị hủy. Điểm dự đoán liên quan của bạn đã được hoàn về ví.",
                    type: "Both",
                    relatedEntityType: "Tournament",
                    relatedEntityId: tournamentId);
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
                action: "Cấu hình tỷ lệ chia thưởng",
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
            var scheduledDate = dto.ScheduledDate!.Value;

            // Validate date nằm trong cửa sổ giải
            if (scheduledDate < tournament.StartDate || scheduledDate > tournament.EndDate)
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

                if (scheduledDate <= previousBoundary)
                    throw new ArgumentException(
                        $"ScheduledDate phải sau {(previousRound.Races.Count > 0 ? "cuộc đua cuối" : "ngày")} của vòng trước (Round #{previousRound.RoundId}, {previousBoundary:u})");
            }

            // Vòng kế tiếp (nếu đã tồn tại) phải bắt đầu sau vòng đang tạo.
            var nextRound = existingRounds
                .Where(r => r.SequenceOrder > dto.SequenceOrder)
                .OrderBy(r => r.SequenceOrder)
                .FirstOrDefault();
            if (nextRound != null && scheduledDate >= nextRound.ScheduledDate)
                throw new ArgumentException(
                    $"ScheduledDate phải trước ngày của vòng kế tiếp (Round #{nextRound.RoundId}, {nextRound.ScheduledDate:u})");

            var round = new Round
            {
                TournamentId = tournamentId,
                Name = dto.Name,
                SequenceOrder = dto.SequenceOrder,
                ScheduledDate = scheduledDate,
                Status = "Upcoming",
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Rounds.Add(round);
            await _context.SaveChangesAsync();

            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Tạo vòng đấu mới",
                entityName: "Round",
                entityId: round.RoundId.ToString(),
                newValue: $"Tournament={tournamentId};Sequence={dto.SequenceOrder};Name={dto.Name};ScheduledDate={scheduledDate:u}");

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
            var scheduledTime = dto.ScheduledTime!.Value;
            var purseAmount = dto.PurseAmount!.Value;

            // Validate thời gian
            if (scheduledTime <= DateTime.UtcNow)
                throw new ArgumentException("Thời gian thi đấu phải ở tương lai.");

            if (scheduledTime < tournament.StartDate || scheduledTime > tournament.EndDate)
                throw new ArgumentException(
                    $"Thời gian thi đấu phải nằm trong thời gian diễn ra giải ({tournament.StartDate:d} - {tournament.EndDate:d}).");

            // Bug 8 fix — kiểm tra trùng RaceNumber trong cùng round
            if (scheduledTime < round.ScheduledDate)
                throw new ArgumentException("Thời gian thi đấu không được sớm hơn ngày của vòng.");

            var isDuplicateRaceNumber = await _context.Races
                .AnyAsync(r => r.RoundId == roundId && r.RaceNumber == dto.RaceNumber);
            if (isDuplicateRaceNumber)
                throw new ArgumentException($"Số cuộc đua {dto.RaceNumber} đã tồn tại trong vòng #{roundId}.");

            // Validate tổng PurseAmount không vượt giải
            var existingPurseTotal = await _context.Races
                .Where(r => r.Round.TournamentId == tournament.TournamentId)
                .SumAsync(r => r.PurseAmount);

            if (existingPurseTotal + purseAmount > tournament.PurseAmount)
                throw new ArgumentException(
                    $"Tổng giải thưởng các cuộc đua ({existingPurseTotal + purseAmount}) vượt quá tổng giải thưởng của giải ({tournament.PurseAmount}).");

            var race = new Race
            {
                RoundId = roundId,
                RaceNumber = dto.RaceNumber,
                ScheduledTime = scheduledTime,
                PurseAmount = purseAmount,
                TrackTypeOverride = dto.TrackTypeOverride,
                RaceDistanceOverride = dto.RaceDistanceOverride,
                Status = "Upcoming",
                IsPostPositionDrawn = false,
                // Chỉ mở sau khi Referee chốt official starting list.
                IsPredictionGateClosed = true,
                ConfirmationCutoffHours = dto.ConfirmationCutoffHours,
                ProtestDeadlineMinutes = dto.ProtestDeadlineMinutes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Races.Add(race);
            await _context.SaveChangesAsync();

            await _auditLog.LogAsync(
                actorId: adminUserId,
                action: "Tạo cuộc đua mới",
                entityName: "Race",
                entityId: race.RaceId.ToString(),
                newValue: $"Round={roundId};RaceNumber={dto.RaceNumber};ScheduledTime={scheduledTime:u};Purse={purseAmount}");

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
                IsPostPositionDrawn = race.IsPostPositionDrawn,
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
            var scheduledTime = dto.ScheduledTime!.Value;
            var purseAmount = dto.PurseAmount!.Value;

            // Chỉ các trường nhạy cảm mới bị đóng băng sau khi bốc thăm hoặc đã có Prediction.
            // Cho phép sửa các trường không nhạy cảm (PurseAmount, cutoff...) ngay cả khi đã đóng băng.
            var sensitiveChanged =
                race.ScheduledTime != scheduledTime ||
                race.RaceDistanceOverride != dto.RaceDistanceOverride ||
                race.TrackTypeOverride != dto.TrackTypeOverride;

            // Dung guard chung cua Module E thay vi viet lai logic freeze inline (throw RACE_CONFIG_FROZEN).
            if (sensitiveChanged)
                await _raceEntry.EnsureRaceConfigEditableAsync(raceId);

            // Validate cửa sổ thời gian (chỉ khi ScheduledTime thay đổi).
            if (race.ScheduledTime != scheduledTime)
            {
                if (scheduledTime <= DateTime.UtcNow)
                    throw new ArgumentException("Thời gian thi đấu phải ở tương lai.");

                if (scheduledTime < tournament.StartDate || scheduledTime > tournament.EndDate)
                    throw new ArgumentException(
                        $"Thời gian thi đấu phải nằm trong thời gian diễn ra giải ({tournament.StartDate:d} - {tournament.EndDate:d}).");

                if (scheduledTime < race.Round.ScheduledDate)
                    throw new ArgumentException("Thời gian thi đấu không được sớm hơn ngày của vòng.");
            }

            // Tổng PurseAmount không vượt quỹ giải (trừ chính race này).
            if (race.PurseAmount != purseAmount)
            {
                var otherPurseTotal = await _context.Races
                    .Where(r => r.Round.TournamentId == tournament.TournamentId && r.RaceId != raceId)
                    .SumAsync(r => r.PurseAmount);

                if (otherPurseTotal + purseAmount > tournament.PurseAmount)
                    throw new ArgumentException(
                        $"Tổng giải thưởng các cuộc đua ({otherPurseTotal + purseAmount}) vượt quá tổng giải thưởng của giải ({tournament.PurseAmount}).");
            }

            var raceChanges = new List<string>();
            void TrackRaceChange<T>(string field, T oldValue, T newValue)
            {
                if (!EqualityComparer<T>.Default.Equals(oldValue, newValue))
                    raceChanges.Add($"{field}: {oldValue} -> {newValue}");
            }
            TrackRaceChange("ScheduledTime", race.ScheduledTime, scheduledTime);
            TrackRaceChange("PurseAmount", race.PurseAmount, purseAmount);
            TrackRaceChange("TrackTypeOverride", race.TrackTypeOverride, dto.TrackTypeOverride);
            TrackRaceChange("RaceDistanceOverride", race.RaceDistanceOverride, dto.RaceDistanceOverride);
            TrackRaceChange("ConfirmationCutoffHours", race.ConfirmationCutoffHours, dto.ConfirmationCutoffHours);
            TrackRaceChange("ProtestDeadlineMinutes", race.ProtestDeadlineMinutes, dto.ProtestDeadlineMinutes);

            race.ScheduledTime = scheduledTime;
            race.PurseAmount = purseAmount;
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
                    action: "Cập nhật thông tin cuộc đua",
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
                IsPostPositionDrawn = race.IsPostPositionDrawn,
                ConfirmationCutoffHours = race.ConfirmationCutoffHours,
                ProtestDeadlineMinutes = race.ProtestDeadlineMinutes,
            };
        }
    }
}
