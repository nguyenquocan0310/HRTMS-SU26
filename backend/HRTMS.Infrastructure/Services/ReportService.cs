using System.Globalization;
using System.Text;
using HRTMS.Core.DTOs.Report;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

/// <summary>
/// Module P — REQ-F-RPT.1 (CSV) + REQ-F-RPT.3 (RBAC).
/// RBAC filter được nhúng vào IQueryable trước khi materialize, không lọc ở memory.
/// PDF server-side không nằm trong phase này: FE render print-view từ <see cref="GetReportAsync"/>.
/// </summary>
public class ReportService : IReportService
{
    public const string AuditAction = "Export_Report";
    public const string AuditEntityName = "Report";

    private const string RaceOfficial = "Official";
    private const string EntryCancelled = "Cancelled";
    private const string CsvFormat = "csv";

    private const string RoleAdmin = "Admin";
    private const string RoleOwner = "Owner";
    private const string RoleJockey = "Jockey";
    private const string RoleSpectator = "Spectator";

    private readonly HRTMSDbContext _context;
    private readonly IAuditLogService _auditLog;

    public ReportService(HRTMSDbContext context, IAuditLogService auditLog)
    {
        _context = context;
        _auditLog = auditLog;
    }

    // =====================================================================
    // Public API
    // =====================================================================

    public async Task<ReportDataDto> GetReportAsync(string type, int tournamentId, int userId, string? role)
    {
        var reportType = ParseType(type);
        EnsureRoleAllowed(role, reportType);
        var tournamentName = await RequireTournamentNameAsync(tournamentId);

        return await BuildReportAsync(reportType, tournamentId, tournamentName, userId, role!);
    }

    public async Task<ReportFileDto> ExportCsvAsync(string type, string? format, int tournamentId, int userId,
                                                    string? role, string? ipAddress = null, string? userAgent = null)
    {
        var reportType = ParseType(type);
        EnsureFormatSupported(format);

        try
        {
            EnsureRoleAllowed(role, reportType);
        }
        catch (UnauthorizedAccessException)
        {
            await WriteAuditAsync(userId, role, reportType, tournamentId, "denied", null, ipAddress, userAgent);
            throw;
        }

        var tournamentName = await RequireTournamentNameAsync(tournamentId);
        var data = await BuildReportAsync(reportType, tournamentId, tournamentName, userId, role!);

        var file = new ReportFileDto
        {
            FileName = BuildFileName(reportType, tournamentId),
            ContentType = "text/csv",
            Content = BuildCsv(data)
        };

        await WriteAuditAsync(userId, role, reportType, tournamentId, "success", data.Rows.Count, ipAddress, userAgent);
        return file;
    }

    // =====================================================================
    // Validation
    // =====================================================================

    private static ReportType ParseType(string type) => type?.Trim().ToLowerInvariant() switch
    {
        "tournament-results" => ReportType.TournamentResults,
        "race-results" => ReportType.RaceResults,
        "purse-payouts" => ReportType.PursePayouts,
        "entry-list" => ReportType.EntryList,
        _ => throw new ArgumentException(
            "Loại báo cáo không hợp lệ. Chọn: tournament-results, race-results, purse-payouts, entry-list.")
    };

    private static void EnsureFormatSupported(string? format)
    {
        var value = string.IsNullOrWhiteSpace(format) ? CsvFormat : format.Trim().ToLowerInvariant();
        if (value != CsvFormat)
            throw new ArgumentException("Định dạng xuất không được hỗ trợ. Hiện chỉ hỗ trợ format=csv.");
    }

    /// <summary>RBAC gate: role lấy từ claims, không nhận từ query param/body.</summary>
    private static void EnsureRoleAllowed(string? role, ReportType type)
    {
        if (role is not (RoleAdmin or RoleOwner or RoleJockey or RoleSpectator))
            throw new UnauthorizedAccessException("Vai trò của bạn không được phép xuất báo cáo.");

        // Purse payout là dữ liệu chi trả cá nhân — không public cho Spectator.
        if (role == RoleSpectator && type == ReportType.PursePayouts)
            throw new UnauthorizedAccessException("Bạn không có quyền xem báo cáo chi trả thưởng.");
    }

    private async Task<string> RequireTournamentNameAsync(int tournamentId)
    {
        if (tournamentId <= 0)
            throw new ArgumentException("tournamentId không hợp lệ.");

        var name = await _context.Tournaments.AsNoTracking()
            .Where(t => t.TournamentId == tournamentId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync();

        return name ?? throw new KeyNotFoundException("Không tìm thấy giải đấu.");
    }

    // =====================================================================
    // Query + RBAC filter (áp dụng trên IQueryable, chạy tại database)
    // =====================================================================

    private Task<ReportDataDto> BuildReportAsync(ReportType type, int tournamentId, string tournamentName,
                                                 int userId, string role) => type switch
    {
        ReportType.TournamentResults => TournamentResultsAsync(tournamentId, tournamentName, userId, role),
        ReportType.RaceResults => RaceResultsAsync(tournamentId, tournamentName, userId, role),
        ReportType.PursePayouts => PursePayoutsAsync(tournamentId, tournamentName, userId, role),
        _ => EntryListAsync(tournamentId, tournamentName, userId, role)
    };

    /// <summary>Lọc RaceEntry theo quyền: Owner theo ngựa sở hữu, Jockey theo pairing, Spectator chỉ race Official.</summary>
    private static IQueryable<RaceEntry> ScopeEntries(IQueryable<RaceEntry> query, string role, int userId) => role switch
    {
        RoleOwner => query.Where(e => e.Pairing.Horse.OwnerId == userId),
        RoleJockey => query.Where(e => e.Pairing.JockeyId == userId),
        RoleSpectator => query.Where(e => e.Race.Status == RaceOfficial
                                          && !e.IsWithdrawn
                                          && e.Status != EntryCancelled),
        _ => query
    };

    private async Task<ReportDataDto> TournamentResultsAsync(int tournamentId, string tournamentName, int userId, string role)
    {
        var query = _context.RaceEntries.AsNoTracking()
            .Where(e => e.Race.Round.TournamentId == tournamentId && e.Race.Status == RaceOfficial);

        var rows = await ScopeEntries(query, role, userId)
            .OrderBy(e => e.Race.Round.SequenceOrder)
            .ThenBy(e => e.Race.RaceNumber)
            .ThenBy(e => e.FinishPosition ?? int.MaxValue)
            .ThenBy(e => e.RaceEntryId)
            .Select(e => new
            {
                e.Race.Round.SequenceOrder,
                RoundName = e.Race.Round.Name,
                e.Race.RaceId,
                e.Race.RaceNumber,
                RaceStatus = e.Race.Status,
                e.Pairing.HorseId,
                HorseName = e.Pairing.Horse.Name,
                JockeyName = e.Pairing.Jockey.Jockey.FullName,
                e.FinishPosition,
                e.FinishTime,
                e.AdvancementStatus,
                e.PointsAwarded,
                e.EarningsAwarded
            })
            .ToListAsync();

        return new ReportDataDto
        {
            Type = "tournament-results",
            TournamentId = tournamentId,
            TournamentName = tournamentName,
            Headers = new[]
            {
                "TournamentId", "TournamentName", "RoundSequence", "RoundName", "RaceId", "RaceNumber",
                "RaceStatus", "HorseId", "HorseName", "JockeyName", "FinishPosition", "FinishTime",
                "AdvancementStatus", "PointsAwarded", "EarningsAwarded"
            },
            Rows = rows.Select(r => new string?[]
            {
                Num(tournamentId), tournamentName, Num(r.SequenceOrder), r.RoundName, Num(r.RaceId), Num(r.RaceNumber),
                r.RaceStatus, Num(r.HorseId), r.HorseName, r.JockeyName, Num(r.FinishPosition), Dec(r.FinishTime),
                r.AdvancementStatus, Num(r.PointsAwarded), Dec(r.EarningsAwarded)
            }).ToList()
        };
    }

    private async Task<ReportDataDto> RaceResultsAsync(int tournamentId, string tournamentName, int userId, string role)
    {
        var query = _context.RaceEntries.AsNoTracking()
            .Where(e => e.Race.Round.TournamentId == tournamentId);

        var rows = await ScopeEntries(query, role, userId)
            .OrderBy(e => e.Race.Round.SequenceOrder)
            .ThenBy(e => e.Race.RaceNumber)
            .ThenBy(e => e.FinishPosition ?? int.MaxValue)
            .ThenBy(e => e.RaceEntryId)
            .Select(e => new
            {
                RoundName = e.Race.Round.Name,
                e.Race.RaceId,
                e.Race.RaceNumber,
                RaceStatus = e.Race.Status,
                e.Race.ScheduledTime,
                e.RaceEntryId,
                e.PairingId,
                e.PostPosition,
                e.Pairing.HorseId,
                HorseName = e.Pairing.Horse.Name,
                JockeyName = e.Pairing.Jockey.Jockey.FullName,
                EntryStatus = e.Status,
                e.IsWithdrawn,
                e.FinishPosition,
                e.FinishTime,
                e.PointsAwarded,
                e.EarningsAwarded
            })
            .ToListAsync();

        return new ReportDataDto
        {
            Type = "race-results",
            TournamentId = tournamentId,
            TournamentName = tournamentName,
            Headers = new[]
            {
                "TournamentId", "TournamentName", "RoundName", "RaceId", "RaceNumber", "RaceStatus",
                "ScheduledTime", "RaceEntryId", "PairingId", "PostPosition", "HorseId", "HorseName",
                "JockeyName", "EntryStatus", "IsWithdrawn", "FinishPosition", "FinishTime",
                "PointsAwarded", "EarningsAwarded"
            },
            Rows = rows.Select(r => new string?[]
            {
                Num(tournamentId), tournamentName, r.RoundName, Num(r.RaceId), Num(r.RaceNumber), r.RaceStatus,
                Ts(r.ScheduledTime), Num(r.RaceEntryId), Num(r.PairingId), Num(r.PostPosition), Num(r.HorseId), r.HorseName,
                r.JockeyName, r.EntryStatus, r.IsWithdrawn ? "true" : "false", Num(r.FinishPosition), Dec(r.FinishTime),
                Num(r.PointsAwarded), Dec(r.EarningsAwarded)
            }).ToList()
        };
    }

    /// <summary>Đọc PursePayouts đã ghi nhận bởi Module K — không tính lại payout.</summary>
    private async Task<ReportDataDto> PursePayoutsAsync(int tournamentId, string tournamentName, int userId, string role)
    {
        var query = _context.PursePayouts.AsNoTracking()
            .Where(p => p.RaceEntry.Race.Round.TournamentId == tournamentId);

        query = role switch
        {
            RoleOwner => query.Where(p => p.RaceEntry.Pairing.Horse.OwnerId == userId),
            RoleJockey => query.Where(p => p.RaceEntry.Pairing.JockeyId == userId),
            _ => query
        };

        var rows = await query
            .OrderBy(p => p.RaceEntry.Race.Round.SequenceOrder)
            .ThenBy(p => p.RaceEntry.Race.RaceNumber)
            .ThenBy(p => p.RaceEntry.FinishPosition ?? int.MaxValue)
            .ThenBy(p => p.PursePayoutId)
            .Select(p => new
            {
                RoundName = p.RaceEntry.Race.Round.Name,
                p.RaceEntry.Race.RaceId,
                p.RaceEntry.Race.RaceNumber,
                p.PursePayoutId,
                p.RaceEntryId,
                p.RaceEntry.Pairing.HorseId,
                HorseName = p.RaceEntry.Pairing.Horse.Name,
                p.RecipientUserId,
                RecipientName = p.RecipientUser.FullName,
                RecipientRole = p.Role,
                p.RaceEntry.FinishPosition,
                p.CalculatedAmount,
                p.PayoutStatus,
                p.PaidAt
            })
            .ToListAsync();

        return new ReportDataDto
        {
            Type = "purse-payouts",
            TournamentId = tournamentId,
            TournamentName = tournamentName,
            Headers = new[]
            {
                "TournamentId", "TournamentName", "RoundName", "RaceId", "RaceNumber", "PursePayoutId",
                "RaceEntryId", "HorseId", "HorseName", "RecipientUserId", "RecipientName", "RecipientRole",
                "FinishPosition", "CalculatedAmount", "PayoutStatus", "PaidAt"
            },
            Rows = rows.Select(r => new string?[]
            {
                Num(tournamentId), tournamentName, r.RoundName, Num(r.RaceId), Num(r.RaceNumber), Num(r.PursePayoutId),
                Num(r.RaceEntryId), Num(r.HorseId), r.HorseName, Num(r.RecipientUserId), r.RecipientName, r.RecipientRole,
                Num(r.FinishPosition), Dec(r.CalculatedAmount), r.PayoutStatus, Ts(r.PaidAt)
            }).ToList()
        };
    }

    /// <summary>Pairing là gốc: pairing chưa allocate vẫn xuất hiện với Round/Race rỗng.</summary>
    private async Task<ReportDataDto> EntryListAsync(int tournamentId, string tournamentName, int userId, string role)
    {
        var pairings = _context.Pairings.AsNoTracking().Where(p => p.TournamentId == tournamentId);

        pairings = role switch
        {
            RoleOwner => pairings.Where(p => p.Horse.OwnerId == userId),
            RoleJockey => pairings.Where(p => p.JockeyId == userId),
            _ => pairings
        };

        var joined = pairings.SelectMany(p => p.RaceEntries.DefaultIfEmpty(), (p, e) => new { p, e });

        // Spectator chỉ thấy entry của race đã Official; pairing chưa allocate không public.
        if (role == RoleSpectator)
            joined = joined.Where(x => x.e != null
                                       && x.e.Race.Status == RaceOfficial
                                       && !x.e.IsWithdrawn
                                       && x.e.Status != EntryCancelled);

        var rows = await joined
            .OrderBy(x => x.p.PairingId)
            .ThenBy(x => x.e!.RaceEntryId)
            .Select(x => new
            {
                RoundName = x.e == null ? null : x.e.Race.Round.Name,
                RaceNumber = x.e == null ? (int?)null : x.e.Race.RaceNumber,
                x.p.HorseId,
                HorseName = x.p.Horse.Name,
                OwnerName = x.p.Horse.Owner.Owner.FullName,
                JockeyName = x.p.Jockey.Jockey.FullName,
                x.p.PairingId,
                PairingStatus = x.p.Status,
                EntryStatus = x.e == null ? null : x.e.Status,
                EntryFeeStatus = x.e == null ? null : x.e.EntryFeeStatus,
                IsWithdrawn = x.e == null ? (bool?)null : x.e.IsWithdrawn,
                EnrollmentApprovalStatus = x.p.Horse.TournamentEntries
                    .Where(h => h.TournamentId == tournamentId)
                    .Select(h => h.AdminApprovalStatus)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return new ReportDataDto
        {
            Type = "entry-list",
            TournamentId = tournamentId,
            TournamentName = tournamentName,
            Headers = new[]
            {
                "TournamentId", "TournamentName", "RoundName", "RaceNumber", "HorseId", "HorseName",
                "OwnerName", "JockeyName", "PairingId", "PairingStatus", "EntryStatus", "EntryFeeStatus",
                "IsWithdrawn", "EnrollmentApprovalStatus"
            },
            Rows = rows.Select(r => new string?[]
            {
                Num(tournamentId), tournamentName, r.RoundName, Num(r.RaceNumber), Num(r.HorseId), r.HorseName,
                r.OwnerName, r.JockeyName, Num(r.PairingId), r.PairingStatus, r.EntryStatus, r.EntryFeeStatus,
                r.IsWithdrawn is null ? null : (r.IsWithdrawn.Value ? "true" : "false"), r.EnrollmentApprovalStatus
            }).ToList()
        };
    }

    // =====================================================================
    // CSV (RFC 4180) — StringBuilder, UTF-8 BOM cho Excel đọc tiếng Việt
    // =====================================================================

    private static byte[] BuildCsv(ReportDataDto data)
    {
        var sb = new StringBuilder();
        AppendRow(sb, data.Headers);
        foreach (var row in data.Rows)
            AppendRow(sb, row);

        var body = new UTF8Encoding(false).GetBytes(sb.ToString());
        var bom = Encoding.UTF8.GetPreamble();

        var buffer = new byte[bom.Length + body.Length];
        Buffer.BlockCopy(bom, 0, buffer, 0, bom.Length);
        Buffer.BlockCopy(body, 0, buffer, bom.Length, body.Length);
        return buffer;
    }

    private static void AppendRow(StringBuilder sb, string?[] fields)
    {
        for (var i = 0; i < fields.Length; i++)
        {
            if (i > 0) sb.Append(',');
            sb.Append(EscapeCsv(fields[i]));
        }
        sb.Append("\r\n");
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        if (value.IndexOfAny(new[] { ',', '"', '\n', '\r' }) < 0) return value;
        return string.Concat("\"", value.Replace("\"", "\"\""), "\"");
    }

    private static string BuildFileName(ReportType type, int tournamentId)
    {
        var slug = type switch
        {
            ReportType.TournamentResults => "tournament-results",
            ReportType.RaceResults => "race-results",
            ReportType.PursePayouts => "purse-payouts",
            _ => "entry-list"
        };
        return $"{slug}_tournament-{tournamentId}_{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
    }

    private static string? Num(int? value) => value?.ToString(CultureInfo.InvariantCulture);

    private static string? Dec(decimal? value) => value?.ToString(CultureInfo.InvariantCulture);

    private static string? Ts(DateTime? value) => value?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

    // =====================================================================
    // AuditLog — chỉ ghi metadata, không ghi nội dung CSV
    // =====================================================================

    private Task WriteAuditAsync(int userId, string? role, ReportType type, int tournamentId,
                                 string result, int? rowCount, string? ipAddress, string? userAgent)
    {
        var payload = $"{{\"type\":\"{type}\",\"format\":\"{CsvFormat}\",\"tournamentId\":{tournamentId}," +
                      $"\"role\":\"{role}\",\"result\":\"{result}\"" +
                      (rowCount.HasValue ? $",\"rowCount\":{rowCount.Value}" : string.Empty) + "}";

        return _auditLog.LogAsync(userId, AuditAction, AuditEntityName, tournamentId.ToString(),
                                  oldValue: null, newValue: payload, ipAddress: ipAddress, userAgent: userAgent);
    }
}
