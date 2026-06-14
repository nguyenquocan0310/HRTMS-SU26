using HRTMS.Core.DTOs.Tournament;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Infrastructure.Services
{
    public class TournamentSevice : ITournamentServices
    {
        private readonly HRTMSDbContext _context; // 0. readonly là gì, tại sao phải khai báo _context
        private readonly IAuditLogService _auditLog;

        private static readonly string[] ValidBreeds =
            ["Thoroughbred", "Arabian", "Quarter Horse", "Mixed"]; // 1. giải thích tại sao lại code cứng giống ngựa vào đây, nếu cần có thêm giống ngựa mới thì dev sẽ vào thay đổi có đúng không?
        private static readonly string[] ValidTrackType = // 2. Type Track là gì? Tại sao lại tiếp tục code cứng?
            ["Turf", "Dirt", "Synthetic"];
        private static readonly string[] ValidCategories = // 3.  Category là gì?
            ["Open", "Classic", "Maiden"];
        private static readonly Dictionary<string, string> ValidTransitions = new() // 4.  Dictionary là kiểu dữ liệu gì?
        {
            ["Draft"]               = "Open Registration",
            ["Open Registration"]   = "Closed Registration",
            ["Closed Registration"] = "Pre-Race",
            ["Pre-Race"]            = "In-Progress",
            ["In-Progress"]         = "Completed",  // 5.  Có bao nhiêu chuyển pha, Pha nào qua pha nào, chuyển khi nào?
        };
        public TournamentSevice(HRTMSDbContext context, IAuditLogService auditLog) // 6.  Cái này là constructor có đúng không?
        {
            _context = context;
            _auditLog = auditLog;
        }
        


        // PRIVATE HELPER
        private static TournamentResponseDto MapToResponseDto(Tournament t) => new() // 7. tại sao phải có helper kiểu MapToResponse này
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
            EntryFeeAmount = t.EntryFeeAmount,
            PreRaceWeightThresholdKg = t.PreRaceWeightThresholdKg,
            PostRaceWeightDiffThresholdKg = t.PostRaceWeightDiffThresholdKg,
            Status = t.Status,
            CreatedAt = t.CreatedAt,
            Rounds = t.Rounds.Select(r => new RoundResponseDto
            {
                RoundId = r.RoundId,
                Name = r.Name,
                SequenceOrder = r.SequenceOrder, 
                ScheduledDate = r.ScheduledDate, 
                Status = r.Status,
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
            }
            ).ToList(),
            PrizeDistributions = t.PrizeDistributions
                .OrderBy(p => p.Position)
                .Select(p => new PrizeDistributionResponseDto
                {
                    Position = p.Position, 
                    Percentage = p.Percentage
                }).ToList()
        }; // 8. giải thích toàn bộ helper này
        //9. Giải thích chi tiết tác dụng của từng class trong DTOs/Tournament
        public async Task<TournamentResponseDto> CreateTournamentAsync(CreateTournamentDto dto, int createdByUserId) // 10. Task là gì
        {
            // 1. Validate enum values
            if (!ValidBreeds.Contains(dto.AllowedBreed))
                throw new ArgumentException($"AllowedBreed Invalid: {dto.AllowedBreed}");
            if (!ValidTrackType.Contains(dto.TrackType))
                throw new ArgumentException($"TrackType Invalid: {dto.TrackType}");
            if (!ValidCategories.Contains(dto.RaceCategory))
                throw new ArgumentException($"RaceCategory Invalid: {dto.RaceCategory}");

            // 2. Validate date range
            if (dto.EndDate < dto.StartDate)
                throw new ArgumentException("EndDate must be above StartDate");

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
                Status = "Draft",
                CreatedBy = createdByUserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            _context.Tournaments.Add(tournament);
            await _context.SaveChangesAsync(); // 11. await là gì

            // 4. Ghi AuditLog
            await _auditLog.LogAsync(
                actorId: createdByUserId,
                action: "Create_Tournament",
                entityName: "Tournament",
                entityId: tournament.TournamentId.ToString(),
                newValue: tournament.Name
            );

            return MapToResponseDto(tournament); //12. tại sao phải return maptoresponse
        }

        public async Task<TournamentResponseDto?> GetTournamentByIdAsync(int tournamentId)
        {
            var tournament = await _context.Tournaments
                .Include(t => t.Rounds)
                    .ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId); // 13. Giải thích  LINQ này

            return tournament == null ? null : MapToResponseDto(tournament);
        }

        public async Task<List<TournamentResponseDto>> GetAllTournamentsAsync()
        {
            var tournaments = await _context.Tournaments
                .Include(t => t.Rounds)
                    .ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync(); // 14 Giải thích LINQ này

            return tournaments.Select(MapToResponseDto).ToList();
        }

        public async Task<TournamentResponseDto> UpdateTournamentAsync(int tournamentId, UpdateTournamentDto dto) 
        {
            var tournament = await _context.Tournaments
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                .Include(t => t.PrizeDistributions)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId)
                ?? throw new KeyNotFoundException($"Không tìm thấy Tournament #{tournamentId}"); // 15. Giải thích LINQ này

            // TRN.9 — chỉ cho sửa khi còn ở Draft hoặc Open Registration
            if (tournament.Status != "Draft" && tournament.Status != "Open Registration")
                throw new InvalidOperationException(
                    $"Không thể sửa giải ở trạng thái '{tournament.Status}'"); 

            // Chỉ update field nào được gửi lên (nullable pattern)
            if (dto.Name != null) tournament.Name = dto.Name;
            if (dto.Description != null) tournament.Description = dto.Description;
            if (dto.StartDate.HasValue) tournament.StartDate = dto.StartDate.Value;
            if (dto.EndDate.HasValue) tournament.EndDate = dto.EndDate.Value;
            if (dto.MaxHorses.HasValue) tournament.MaxHorses = dto.MaxHorses.Value;
            if (dto.AllowedBreed != null) tournament.AllowedBreed = dto.AllowedBreed;
            if (dto.TrackType != null) tournament.TrackType = dto.TrackType;
            if (dto.RaceDistance.HasValue) tournament.RaceDistance = dto.RaceDistance.Value;
            if (dto.RaceCategory != null) tournament.RaceCategory = dto.RaceCategory;
            if (dto.MinJockeyExperienceYears.HasValue) tournament.MinJockeyExperienceYears = dto.MinJockeyExperienceYears.Value;
            if (dto.PurseAmount.HasValue) tournament.PurseAmount = dto.PurseAmount.Value;
            if (dto.EntryFeeAmount.HasValue) tournament.EntryFeeAmount = dto.EntryFeeAmount.Value;
            if (dto.PreRaceWeightThresholdKg.HasValue) tournament.PreRaceWeightThresholdKg = dto.PreRaceWeightThresholdKg.Value;
            if (dto.PostRaceWeightDiffThresholdKg.HasValue) tournament.PostRaceWeightDiffThresholdKg = dto.PostRaceWeightDiffThresholdKg.Value;

            tournament.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapToResponseDto(tournament);
        }

        public async Task<TournamentResponseDto> ChangeStatusAsync(int tournamentId, string targetStatus, int adminUserId)
        {
            var tournament = await _context.Tournaments
                .Include( t => t.Rounds).ThenInclude(r => r.Races)
                .Include( t => t.PrizeDistributions)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId)
                ?? throw new KeyNotFoundException($"Không tìm thấy Tournament #{tournamentId}"); // 16. Giải thích LINQ này
            // Guard: chi cho phep transition hop le
            if (!ValidTransitions.TryGetValue(tournament.Status, out var allowedNext)||allowedNext != targetStatus) // 17. Giải thích TryGetValue; out var 
            {
                throw new InvalidOperationException($"Khong the chuyen tu '{tournament.Status}' sang '{targetStatus}"); 
            }
            // Guard dac biet: chuyen sang Open Registration phai co PrieDistributions
            if(targetStatus == "Open Registration" && tournament.PrizeDistributions.Count<5)
            {
                throw new InvalidOperationException($"Phai cau hinh du 5 ty le PrizeDistributions truoc khi dang ky ");
            }

            var oldStatus = tournament.Status;
            tournament.Status = targetStatus;
            tournament.UpdatedAt = DateTime.UtcNow; 

            await _context.SaveChangesAsync(); // 18. await là gì, có tác dụng gì trong này 
            await _auditLog.LogAsync(
                actorId: adminUserId,
                action : "Change_Tournament_Status", 
                entityName: "Tournament", 
                entityId: tournamentId.ToString(), 
                oldValue: oldStatus, 
                newValue: targetStatus
                );
            return MapToResponseDto( tournament );
        }

        public async Task CancelTournamentAsync(int tournamentId, int adminUserId)
        {
            // Load đầy đủ data liên quan
            var tournament = await _context.Tournaments
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                    .ThenInclude(race => race.RaceEntries)
                .Include(t => t.Rounds).ThenInclude(r => r.Races)
                    .ThenInclude(race => race.Predictions)
                .FirstOrDefaultAsync(t => t.TournamentId == tournamentId)
                ?? throw new KeyNotFoundException($"Không tìm thấy Tournament #{tournamentId}"); // 19. Giải thích LINQ này

            if (tournament.Status == "Completed")
                throw new InvalidOperationException("Không thể hủy giải đã hoàn thành");

            // ── BẮT ĐẦU TRANSACTION ──────────────────────────────────
            using var transaction = await _context.Database.BeginTransactionAsync(); // 20. Bắt đầu transaction trong database hay trong hệ thống 
            try
            {
                var now = DateTime.UtcNow; // 21. Tại sao phải có thời gian 
                var affectedUserIds = new HashSet<int>(); // 22. HashSet để làm gì 

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

                            // TRN.10 — EC-32: entry đã Paid → chuyển sang Refund Pending
                            if (entry.Status == "Paid")
                                entry.Status = "Refund Pending";
                            else
                                entry.Status = "Cancelled";

                            entry.UpdatedAt = now; 
                        }

                        // 4. Hoàn điểm ảo cho Predictions đang Pending
                        foreach (var prediction in race.Predictions.Where(p => p.Status == "Pending"))
                        {
                            var spectator = await _context.SpectatorProfiles
                                .FirstOrDefaultAsync(s => s.SpectatorId == prediction.SpectatorId); // 23. Giải thích LINQ này


                            if (spectator?.Wallet != null) // 24. Giải thích dòng này
                            {
                                spectator.Wallet.Balance += prediction.PointsPlaced;  // hoàn điểm vào Wallet
                                spectator.Wallet.UpdatedAt = now; // 25. Giai đoạn này có liên quan gì đến vptransaction không
                            }

                            prediction.Status = "Refunded";

                            affectedUserIds.Add(prediction.SpectatorId); // 26. Tại sao phải có dòng này
                        }
                    }

                // 5. Gửi Notification cho tất cả user bị ảnh hưởng
                foreach (var userId in affectedUserIds)
                {
                    _context.Notifications.Add(new Notification
                    {
                        RecipientId = userId,
                        Title = "Giải đấu bị hủy",
                        Message = $"Giải đấu '{tournament.Name}' đã bị hủy bởi Ban tổ chức.",
                        Type = "Tournament_Cancelled",
                        IsRead = false,
                        RelatedEntityType = "Tournament",
                        RelatedEntityId = tournamentId,
                        SentAt = now,
                    });
                }

                await _context.SaveChangesAsync();

                // 6. Ghi AuditLog
                await _auditLog.LogAsync(
                    actorId: adminUserId,
                    action: "Cancel_Tournament",
                    entityName: "Tournament",
                    entityId: tournamentId.ToString(),
                    oldValue: "Active",
                    newValue: "Cancelled"
                );

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw; // re-throw để Controller bắt và trả 500
            }
        }

        public async Task<List<PrizeDistributionResponseDto>> SetPrizeDistributionAsync(int tournamentId, SetPrizeDistributionDto dto)
        {
            //1. Validate du 5 position khong trung 
            var positions = dto.Distributions.Select(d => d.Position).OrderBy(p => p).ToList();
            if (positions.Count != 5 || !positions.SequenceEqual([1, 2, 3, 4, 5])) // 27. Giải thích syntax này, cái này phải lambda không 
                throw new ArgumentException($"Phai nhap dung 5 vi tri tu 1 den 5, khong trung");
            //2. Validate tong = 100% - dung decimal de tranh floating point error
            var total = dto.Distributions.Sum(d => d.Percentage);
            if (Math.Round(total, 2) != 100m) 
                throw new ArgumentException($"Tong ty le phai = 100%, hien tai = {total}%");
            //3. Upsert - xoa cu, insert moi trong cung transaction
            var existing = await _context.PrizeDistributions // 28. Tại sao phải có await
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

            return newItems
                .OrderBy(p => p.Position)
                .Select(p => new PrizeDistributionResponseDto
                {
                    Position = p.Position,
                    Percentage = p.Percentage
                }).ToList(); // 29. Giải thích LINQ này
        }

        public async Task<RoundResponseDto> CreateRoundAsync(int tournamentId, CreateRoundDto dto)
        {
            var tournament = await _context.Tournaments.FindAsync(tournamentId) // 30. Async có nghĩa là gì
                ?? throw new KeyNotFoundException($"Không tìm thấy Tournament #{tournamentId}");

            // TRN.7 — validate date nằm trong cửa sổ giải
            if (dto.ScheduledDate < tournament.StartDate || dto.ScheduledDate > tournament.EndDate)
                throw new ArgumentException(
                    $"ScheduledDate phải nằm trong [{tournament.StartDate:d}, {tournament.EndDate:d}]");

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

            return new RoundResponseDto
            {
                RoundId = round.RoundId,
                Name = round.Name,
                SequenceOrder = round.SequenceOrder,
                ScheduledDate = round.ScheduledDate,
                Status = round.Status,
                Races = []
            };
        }

        public async Task<RaceResponseDto> CreateRaceAsync(int roundId, CreateRaceDto dto)
        {
            // Load Round kèm Tournament để validate
            var round = await _context.Rounds
                .Include(r => r.Tournament)
                .FirstOrDefaultAsync(r => r.RoundId == roundId)
                ?? throw new KeyNotFoundException($"Không tìm thấy Round #{roundId}"); // 31. Giải thích LINQ này

            var tournament = round.Tournament;

            // TRN.7 — validate thời gian
            if (dto.ScheduledTime <= DateTime.UtcNow)
                throw new ArgumentException("ScheduledTime phải ở tương lai");

            if (dto.ScheduledTime < tournament.StartDate || dto.ScheduledTime > tournament.EndDate)
                throw new ArgumentException(
                    $"ScheduledTime phải nằm trong cửa sổ giải [{tournament.StartDate:d}, {tournament.EndDate:d}]");

            // TRN.7 — validate tổng PurseAmount không vượt giải
            var existingPurseTotal = await _context.Races
                .Where(r => r.Round.TournamentId == tournament.TournamentId)
                .SumAsync(r => r.PurseAmount); // 32. Giải thích LINQ này

            if (existingPurseTotal + dto.PurseAmount > tournament.PurseAmount)
                throw new ArgumentException(
                    $"Tổng quỹ Race ({existingPurseTotal + dto.PurseAmount}) vượt quỹ giải ({tournament.PurseAmount})");

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
