using System.Reflection;
using System.Text;
using HRTMS.API.Controllers;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRTMS.Tests;

/// <summary>
/// Module P — REQ-F-RPT.1 (CSV) + REQ-F-RPT.3 (RBAC).
/// SQLite in-memory: RBAC filter chạy đúng như trên database provider thật.
/// Race 1 = Official, Race 2 = Unofficial → dùng để chứng minh Spectator chỉ thấy race Official.
/// </summary>
public sealed class ReportServiceTests : IDisposable
{
    private const int AdminId = 1;
    private const int OwnerAId = 10;
    private const int OwnerBId = 11;
    private const int JockeyXId = 20;
    private const int JockeyYId = 21;
    private const int SpectatorId = 30;

    private const int TournamentId = 1;
    private const int EmptyTournamentId = 2;
    private const int OfficialRaceId = 1;
    private const int UnofficialRaceId = 2;

    // Tên có dấu phẩy + dấu ngoặc kép + xuống dòng → kiểm tra escape CSV.
    private const string HorseAName = "Ngựa \"Sấm Sét\", số 1\nHàng hai";
    private const string HorseBName = "Ngựa Bão Tố";
    private const string TournamentName = "Giải Mùa Hè, 2026";

    private readonly SqliteConnection _conn;
    private readonly RecordingAuditLog _audit = new();

    public ReportServiceTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        using var ctx = NewContext();
        ctx.Database.EnsureCreated();
        Seed(ctx);
    }

    private HRTMSDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<HRTMSDbContext>().UseSqlite(_conn).Options;
        return new HRTMSDbContext(options);
    }

    private ReportService NewService() => new(NewContext(), _audit);

    public void Dispose() => _conn.Dispose();

    // =====================================================================
    // Seed
    // =====================================================================

    private static void Seed(HRTMSDbContext ctx)
    {
        var now = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);

        ctx.Users.AddRange(
            NewUser(AdminId, "admin", "Quản trị viên", "Admin", now),
            NewUser(OwnerAId, "ownerA", "Chủ ngựa A", "Owner", now),
            NewUser(OwnerBId, "ownerB", "Chủ ngựa B", "Owner", now),
            NewUser(JockeyXId, "jockeyX", "Nài X", "Jockey", now),
            NewUser(JockeyYId, "jockeyY", "Nài Y", "Jockey", now),
            NewUser(SpectatorId, "spec", "Khán giả", "Spectator", now));

        ctx.OwnerProfiles.AddRange(
            new OwnerProfile { OwnerId = OwnerAId, CreatedAt = now, UpdatedAt = now },
            new OwnerProfile { OwnerId = OwnerBId, CreatedAt = now, UpdatedAt = now });

        ctx.JockeyProfiles.AddRange(
            NewJockeyProfile(JockeyXId, now),
            NewJockeyProfile(JockeyYId, now));

        ctx.Tournaments.AddRange(
            NewTournament(TournamentId, TournamentName, now),
            NewTournament(EmptyTournamentId, "Giải rỗng", now));

        ctx.Rounds.Add(new Round
        {
            RoundId = 1, TournamentId = TournamentId, Name = "Vòng loại",
            SequenceOrder = 1, ScheduledDate = now, Status = "Completed", UpdatedAt = now
        });

        ctx.Races.AddRange(
            NewRace(OfficialRaceId, raceNumber: 1, status: "Official", now),
            NewRace(UnofficialRaceId, raceNumber: 2, status: "Unofficial", now));

        ctx.Horses.AddRange(
            NewHorse(1, OwnerAId, HorseAName, now),
            NewHorse(2, OwnerBId, HorseBName, now));

        // Pairings có composite FK → TournamentParticipants(TournamentId, UserId) của Jockey.
        ctx.TournamentParticipants.AddRange(
            NewParticipant(1, JockeyXId, "Jockey", now),
            NewParticipant(2, JockeyYId, "Jockey", now),
            NewParticipant(3, OwnerAId, "Owner", now),
            NewParticipant(4, OwnerBId, "Owner", now));

        ctx.HorseTournamentEntries.AddRange(
            NewEnrollment(1, horseId: 1, ownerId: OwnerAId, now),
            NewEnrollment(2, horseId: 2, ownerId: OwnerBId, now));

        ctx.Pairings.AddRange(
            NewPairing(1, horseId: 1, jockeyId: JockeyXId, now),
            NewPairing(2, horseId: 2, jockeyId: JockeyYId, now));

        ctx.RaceEntries.AddRange(
            NewEntry(1, OfficialRaceId, pairingId: 1, finishPosition: 1, now),
            NewEntry(2, OfficialRaceId, pairingId: 2, finishPosition: 2, now),
            NewEntry(3, UnofficialRaceId, pairingId: 1, finishPosition: 1, now));

        ctx.PursePayouts.AddRange(
            NewPayout(1, raceEntryId: 1, recipient: OwnerAId, role: "Owner", amount: 700m, now),
            NewPayout(2, raceEntryId: 1, recipient: JockeyXId, role: "Jockey", amount: 300m, now),
            NewPayout(3, raceEntryId: 2, recipient: OwnerBId, role: "Owner", amount: 200m, now));

        ctx.SaveChanges();
    }

    private static User NewUser(int id, string username, string fullName, string role, DateTime now) => new()
    {
        UserId = id, Username = username, FullName = fullName,
        Email = $"{username}@test.local", NormalizedEmail = $"{username.ToUpperInvariant()}@TEST.LOCAL",
        PasswordHash = "x", Role = role, Status = "Active", CreatedAt = now, UpdatedAt = now
    };

    private static JockeyProfile NewJockeyProfile(int id, DateTime now) => new()
    {
        JockeyId = id, LicenseCertificate = $"LIC-{id}", ExperienceYears = 5,
        SelfDeclaredWeight = 55m, Status = "Active", CreatedAt = now, UpdatedAt = now
    };

    private static Tournament NewTournament(int id, string name, DateTime now) => new()
    {
        TournamentId = id, Name = name, StartDate = now, EndDate = now.AddDays(3),
        MaxHorses = 24, AllowedBreed = "Thoroughbred", TrackType = "Turf", RaceDistance = 1600,
        RaceCategory = "Flat", MinJockeyExperienceYears = 1, PurseAmount = 1000m, EntryFeeAmount = 10m,
        PreRaceWeightThresholdKg = 2m, PostRaceWeightDiffThresholdKg = 2m, Status = "Completed",
        CreatedAt = now, UpdatedAt = now
    };

    private static Race NewRace(int id, int raceNumber, string status, DateTime now) => new()
    {
        RaceId = id, RoundId = 1, RaceNumber = raceNumber, ScheduledTime = now,
        PurseAmount = 1000m, Status = status, ConfirmationCutoffHours = 24,
        ProtestDeadlineMinutes = 120, CreatedAt = now, UpdatedAt = now
    };

    private static Horse NewHorse(int id, int ownerId, string name, DateTime now) => new()
    {
        HorseId = id, OwnerId = ownerId, Name = name, BirthYear = 2020, Gender = "Male",
        Color = "Bay", Weight = 450m, IdentifyingMarks = "None", Breed = "Thoroughbred",
        VaccinationRecordRef = "VR-1", DopingTestResult = "Negative", LegalConsentAccepted = true,
        Status = "Active", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
        CreatedAt = now, UpdatedAt = now
    };

    private static TournamentParticipant NewParticipant(int id, int userId, string role, DateTime now) => new()
    {
        ParticipantId = id, TournamentId = TournamentId, UserId = userId, Role = role,
        Status = "Approved", ScreeningStatus = "AutoEligible", RegisteredAt = now
    };

    private static HorseTournamentEntry NewEnrollment(int id, int horseId, int ownerId, DateTime now) => new()
    {
        EnrollmentId = id, HorseId = horseId, TournamentId = TournamentId, OwnerId = ownerId,
        Status = "Enrolled", ScreeningStatus = "AutoEligible", AdminApprovalStatus = "Approved",
        CreatedAt = now, UpdatedAt = now
    };

    private static Pairing NewPairing(int id, int horseId, int jockeyId, DateTime now) => new()
    {
        PairingId = id, TournamentId = TournamentId, HorseId = horseId, JockeyId = jockeyId,
        Status = "Confirmed", CreatedAt = now, UpdatedAt = now
    };

    private static RaceEntry NewEntry(int id, int raceId, int pairingId, int finishPosition, DateTime now) => new()
    {
        RaceEntryId = id, RaceId = raceId, PairingId = pairingId, PostPosition = pairingId,
        Status = "Confirmed", IndependenceCheckStatus = "Passed", EntryFeeStatus = "Paid",
        FinishPosition = finishPosition, FinishTime = 95.5m, PointsAwarded = 10,
        EarningsAwarded = 100m, IsWithdrawn = false, CreatedAt = now, UpdatedAt = now
    };

    private static PursePayout NewPayout(int id, int raceEntryId, int recipient, string role, decimal amount, DateTime now) => new()
    {
        PursePayoutId = id, RaceEntryId = raceEntryId, RecipientUserId = recipient,
        Role = role, CalculatedAmount = amount, PayoutStatus = "Paid", PaidAt = now, UpdatedAt = now
    };

    // =====================================================================
    // Helpers
    // =====================================================================

    private static readonly string[] AllTypes =
        { "tournament-results", "race-results", "purse-payouts", "entry-list" };

    private static string CsvText(byte[] content) =>
        new UTF8Encoding(false).GetString(content, 3, content.Length - 3);

    private static bool HasBom(byte[] c) => c.Length >= 3 && c[0] == 0xEF && c[1] == 0xBB && c[2] == 0xBF;

    // =====================================================================
    // Admin
    // =====================================================================

    [Fact]
    public async Task Admin_ExportsAllFourReportTypes()
    {
        foreach (var type in AllTypes)
        {
            var file = await NewService().ExportCsvAsync(type, "csv", TournamentId, AdminId, "Admin");

            Assert.Equal("text/csv", file.ContentType);
            Assert.True(HasBom(file.Content), $"{type} thiếu UTF-8 BOM");
            Assert.Contains(type, file.FileName);
            Assert.Contains($"tournament-{TournamentId}", file.FileName);
        }
    }

    [Fact]
    public async Task Admin_SeesBothOwnersInEntryList()
    {
        var data = await NewService().GetReportAsync("entry-list", TournamentId, AdminId, "Admin");

        Assert.Contains(data.Rows, r => r.Contains("Chủ ngựa A"));
        Assert.Contains(data.Rows, r => r.Contains("Chủ ngựa B"));
    }

    [Fact]
    public async Task Admin_RaceResults_IncludeNonOfficialRace()
    {
        var data = await NewService().GetReportAsync("race-results", TournamentId, AdminId, "Admin");

        Assert.Contains(data.Rows, r => r.Contains("Unofficial"));
    }

    // =====================================================================
    // Owner
    // =====================================================================

    [Fact]
    public async Task Owner_EntryList_OnlyOwnHorses()
    {
        var data = await NewService().GetReportAsync("entry-list", TournamentId, OwnerAId, "Owner");

        Assert.NotEmpty(data.Rows);
        Assert.All(data.Rows, r => Assert.Contains(HorseAName, r!));
        Assert.DoesNotContain(data.Rows, r => r.Contains(HorseBName));
        Assert.DoesNotContain(data.Rows, r => r.Contains("Chủ ngựa B"));
    }

    [Fact]
    public async Task Owner_PursePayouts_OnlyOwnHorseEntries()
    {
        var data = await NewService().GetReportAsync("purse-payouts", TournamentId, OwnerAId, "Owner");

        // Payout 1 (Owner A) + payout 2 (Jockey X) đều thuộc entry của ngựa Owner A; payout 3 là của Owner B.
        Assert.Equal(2, data.Rows.Count);
        Assert.All(data.Rows, r => Assert.Contains(HorseAName, r!));
        Assert.DoesNotContain(data.Rows, r => r.Contains("Chủ ngựa B"));
    }

    [Fact]
    public async Task Owner_WithNoHorses_GetsHeaderOnlyCsv()
    {
        var file = await NewService().ExportCsvAsync("entry-list", "csv", EmptyTournamentId, OwnerAId, "Owner");
        var lines = CsvText(file.Content).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Single(lines);
        Assert.StartsWith("TournamentId,TournamentName,RoundName", lines[0]);
    }

    // =====================================================================
    // Jockey
    // =====================================================================

    [Fact]
    public async Task Jockey_RaceResults_OnlyOwnPairings()
    {
        var data = await NewService().GetReportAsync("race-results", TournamentId, JockeyXId, "Jockey");

        Assert.NotEmpty(data.Rows);
        Assert.All(data.Rows, r => Assert.Contains("Nài X", r!));
        Assert.DoesNotContain(data.Rows, r => r.Contains("Nài Y"));
    }

    [Fact]
    public async Task Jockey_PursePayouts_OnlyOwnPairings()
    {
        var data = await NewService().GetReportAsync("purse-payouts", TournamentId, JockeyXId, "Jockey");

        Assert.Equal(2, data.Rows.Count); // cả 2 payout của entry 1 (ngựa mà Jockey X cưỡi)
        Assert.DoesNotContain(data.Rows, r => r.Contains("Chủ ngựa B"));
    }

    // =====================================================================
    // Spectator
    // =====================================================================

    [Fact]
    public async Task Spectator_RaceResults_OnlyOfficialRace()
    {
        var data = await NewService().GetReportAsync("race-results", TournamentId, SpectatorId, "Spectator");

        Assert.NotEmpty(data.Rows);
        Assert.All(data.Rows, r => Assert.Contains("Official", r!));
        Assert.DoesNotContain(data.Rows, r => r.Contains("Unofficial"));
    }

    [Fact]
    public async Task Spectator_EntryList_ExcludesUnallocatedAndNonOfficial()
    {
        var data = await NewService().GetReportAsync("entry-list", TournamentId, SpectatorId, "Spectator");

        // Chỉ 2 entry của race Official (entry 3 thuộc race Unofficial).
        Assert.Equal(2, data.Rows.Count);
    }

    [Fact]
    public async Task Spectator_PursePayouts_Denied()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            NewService().GetReportAsync("purse-payouts", TournamentId, SpectatorId, "Spectator"));
    }

    // =====================================================================
    // Authorization / validation
    // =====================================================================

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Referee")]
    [InlineData("admin")]
    public async Task InvalidRole_IsDenied(string? role)
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            NewService().GetReportAsync("race-results", TournamentId, AdminId, role));
    }

    [Fact]
    public async Task InvalidType_ThrowsArgumentException()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            NewService().ExportCsvAsync("Users", "csv", TournamentId, AdminId, "Admin"));
    }

    [Fact]
    public async Task NonCsvFormat_ThrowsArgumentException()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            NewService().ExportCsvAsync("race-results", "pdf", TournamentId, AdminId, "Admin"));
    }

    [Fact]
    public async Task InvalidTournamentId_ThrowsArgumentException()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            NewService().ExportCsvAsync("race-results", "csv", 0, AdminId, "Admin"));
    }

    [Fact]
    public async Task UnknownTournament_ThrowsKeyNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            NewService().ExportCsvAsync("race-results", "csv", 999, AdminId, "Admin"));
    }

    [Fact]
    public async Task DeniedRole_IsCheckedBeforeTournamentExistence()
    {
        // Role sai + tournament không tồn tại → vẫn là 403, không lộ sự tồn tại của tournament.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            NewService().ExportCsvAsync("race-results", "csv", 999, AdminId, "Referee"));
    }

    /// <summary>Controller không nhận userId/role từ client — chỉ đọc claims.</summary>
    [Fact]
    public void Controller_RequiresAuth_AndDoesNotBindIdentityFromRequest()
    {
        var controller = typeof(ReportController);
        Assert.NotNull(controller.GetCustomAttribute<AuthorizeAttribute>());

        var parameters = controller.GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .Where(m => m.DeclaringType == controller)
            .SelectMany(m => m.GetParameters())
            .Select(p => p.Name!.ToLowerInvariant())
            .ToList();

        Assert.DoesNotContain("userid", parameters);
        Assert.DoesNotContain("role", parameters);
    }

    // =====================================================================
    // CSV encoding
    // =====================================================================

    [Fact]
    public async Task Csv_HasBom_AndStableHeaderOrder()
    {
        var file = await NewService().ExportCsvAsync("purse-payouts", "csv", TournamentId, AdminId, "Admin");

        Assert.True(HasBom(file.Content));
        Assert.Equal("text/csv", file.ContentType);

        var header = CsvText(file.Content).Split("\r\n")[0];
        Assert.Equal(
            "TournamentId,TournamentName,RoundName,RaceId,RaceNumber,PursePayoutId,RaceEntryId,HorseId," +
            "HorseName,RecipientUserId,RecipientName,RecipientRole,FinishPosition,CalculatedAmount," +
            "PayoutStatus,PaidAt",
            header);
    }

    [Fact]
    public async Task Csv_EscapesCommaQuoteAndNewline()
    {
        var file = await NewService().ExportCsvAsync("race-results", "csv", TournamentId, AdminId, "Admin");
        var csv = CsvText(file.Content);

        // Dấu phẩy trong tên giải → bọc quote.
        Assert.Contains("\"Giải Mùa Hè, 2026\"", csv);
        // Quote trong tên ngựa → nhân đôi; newline nằm trong field đã bọc quote.
        Assert.Contains("\"Ngựa \"\"Sấm Sét\"\", số 1\nHàng hai\"", csv);
    }

    [Fact]
    public async Task Csv_NullValues_RenderAsEmptyField()
    {
        // Pairing chưa allocate → RoundName/RaceNumber null trong entry-list.
        using (var ctx = NewContext())
        {
            ctx.Pairings.Add(new Pairing
            {
                PairingId = 3, TournamentId = TournamentId, HorseId = 2, JockeyId = JockeyYId,
                Status = "Cancelled", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            });
            ctx.SaveChanges();
        }

        var data = await NewService().GetReportAsync("entry-list", TournamentId, AdminId, "Admin");
        var unallocated = Assert.Single(data.Rows, r => r[9] == "Cancelled");

        Assert.Null(unallocated[2]);  // RoundName
        Assert.Null(unallocated[3]);  // RaceNumber

        var file = await NewService().ExportCsvAsync("entry-list", "csv", TournamentId, AdminId, "Admin");
        Assert.Contains(",Cancelled,,,", CsvText(file.Content));
    }

    // =====================================================================
    // CSV formula injection + bộ cột theo role
    // =====================================================================

    /// <summary>Thêm pairing (chưa allocate) với tên ngựa tùy ý — xuất hiện trong entry-list Admin.</summary>
    private void AddPairingWithHorseName(int horseId, int pairingId, string horseName)
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;
        ctx.Horses.Add(NewHorse(horseId, OwnerBId, horseName, now));
        ctx.Pairings.Add(new Pairing
        {
            PairingId = pairingId, TournamentId = TournamentId, HorseId = horseId, JockeyId = JockeyYId,
            Status = "Confirmed", CreatedAt = now, UpdatedAt = now
        });
        ctx.SaveChanges();
    }

    [Fact]
    public async Task Csv_FormulaLeadingFields_ArePrefixed()
    {
        AddPairingWithHorseName(10, 10, "=SUM(A1)");
        AddPairingWithHorseName(11, 11, "+cmd|calc");
        AddPairingWithHorseName(12, 12, "@import");
        AddPairingWithHorseName(13, 13, "\tTabName");
        AddPairingWithHorseName(14, 14, "\rCrName");

        var csv = CsvText(
            (await NewService().ExportCsvAsync("entry-list", "csv", TournamentId, AdminId, "Admin")).Content);

        Assert.Contains("'=SUM(A1)", csv);
        Assert.Contains("'+cmd|calc", csv);
        Assert.Contains("'@import", csv);
        Assert.Contains("'\tTabName", csv);
        Assert.Contains("'\rCrName", csv);           // CR-leading: prefix rồi mới bọc quote
        Assert.DoesNotContain(",=SUM(A1)", csv);      // không còn bản chưa neutralize
    }

    [Fact]
    public async Task Csv_NegativeDecimal_NotPrefixed()
    {
        using (var ctx = NewContext())
        {
            // Điều chỉnh payout âm (giả lập thu hồi) — cột số phải giữ nguyên, không prefix.
            ctx.PursePayouts.Add(NewPayout(4, raceEntryId: 1, recipient: OwnerAId,
                role: "Owner", amount: -5.00m, DateTime.UtcNow));
            ctx.SaveChanges();
        }

        var csv = CsvText(
            (await NewService().ExportCsvAsync("purse-payouts", "csv", TournamentId, AdminId, "Admin")).Content);

        // SQLite trim trailing zero của decimal (-5.00m → "-5") — assert không phụ thuộc scale.
        // Điều test cần chứng minh: số âm KHÔNG bị prefix apostrophe.
        Assert.Contains(",-5", csv);
        Assert.DoesNotContain("'-5", csv);
    }

    [Fact]
    public async Task Spectator_EntryList_HasReducedColumns()
    {
        var data = await NewService().GetReportAsync("entry-list", TournamentId, SpectatorId, "Spectator");

        Assert.Equal(11, data.Headers.Length);
        Assert.DoesNotContain("PairingStatus", data.Headers);
        Assert.DoesNotContain("EntryFeeStatus", data.Headers);
        Assert.DoesNotContain("EnrollmentApprovalStatus", data.Headers);
        Assert.Contains("OwnerName", data.Headers); // quyết định nhóm: OwnerName giữ lại

        Assert.NotEmpty(data.Rows);
        Assert.All(data.Rows, r => Assert.Equal(11, r.Length));
        // Giá trị trạng thái nội bộ không còn xuất hiện ở bất kỳ cell nào.
        Assert.All(data.Rows, r => Assert.DoesNotContain("Paid", r));
        Assert.All(data.Rows, r => Assert.DoesNotContain("Approved", r));
    }

    [Fact]
    public async Task AdminOwnerJockey_EntryList_KeepFullColumns()
    {
        foreach (var (userId, role) in new[] { (AdminId, "Admin"), (OwnerAId, "Owner"), (JockeyXId, "Jockey") })
        {
            var data = await NewService().GetReportAsync("entry-list", TournamentId, userId, role);

            Assert.Equal(14, data.Headers.Length);
            Assert.Contains("PairingStatus", data.Headers);
            Assert.Contains("EntryFeeStatus", data.Headers);
            Assert.Contains("EnrollmentApprovalStatus", data.Headers);
            Assert.NotEmpty(data.Rows);
            Assert.All(data.Rows, r => Assert.Equal(14, r.Length));
        }
    }

    // =====================================================================
    // Audit log
    // =====================================================================

    [Fact]
    public async Task Export_WritesExportReportAuditLog()
    {
        await NewService().ExportCsvAsync("entry-list", "csv", TournamentId, AdminId, "Admin", "127.0.0.1", "xunit");

        var entry = Assert.Single(_audit.Entries);
        Assert.Equal("Export_Report", entry.Action);
        Assert.Equal("Report", entry.EntityName);
        Assert.Equal(TournamentId.ToString(), entry.EntityId);
        Assert.Equal(AdminId, entry.ActorId);
        Assert.Contains("\"result\":\"success\"", entry.NewValue);
        Assert.Contains("\"role\":\"Admin\"", entry.NewValue);
        Assert.Contains("\"format\":\"csv\"", entry.NewValue);
        Assert.Contains("\"rowCount\":", entry.NewValue);
        Assert.DoesNotContain(HorseAName, entry.NewValue); // không log nội dung CSV
    }

    [Fact]
    public async Task DeniedExport_WritesDeniedAuditLog()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            NewService().ExportCsvAsync("purse-payouts", "csv", TournamentId, SpectatorId, "Spectator"));

        var entry = Assert.Single(_audit.Entries);
        Assert.Equal("Export_Report", entry.Action);
        Assert.Equal(SpectatorId, entry.ActorId);
        Assert.Contains("\"result\":\"denied\"", entry.NewValue);
    }

    [Fact]
    public async Task InvalidType_WritesNoAuditLog()
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            NewService().ExportCsvAsync("Users", "csv", TournamentId, AdminId, "Admin"));

        Assert.Empty(_audit.Entries);
    }

    private sealed record AuditEntry(int ActorId, string Action, string EntityName, string EntityId, string NewValue);

    private sealed class RecordingAuditLog : IAuditLogService
    {
        public List<AuditEntry> Entries { get; } = new();

        public Task LogAsync(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
        {
            Entries.Add(new AuditEntry(actorId, action, entityName, entityId, newValue ?? string.Empty));
            return Task.CompletedTask;
        }

        public void LogDeferred(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
            => Entries.Add(new AuditEntry(actorId, action, entityName, entityId, newValue ?? string.Empty));
    }
}
