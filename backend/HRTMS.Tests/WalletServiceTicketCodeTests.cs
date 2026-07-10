using System.Security.Cryptography;
using System.Text;
using HRTMS.Core.DTOs.Wallet;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using HRTMS.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRTMS.Tests;

/// <summary>
/// Ticket Code Bonus redemption (BR-63 / REQ-F-PRD.5).
/// Dùng SQLite in-memory (relational) để test đúng ExecuteUpdateAsync + transaction —
/// EF InMemory provider không hỗ trợ hai tính năng này.
/// </summary>
public sealed class WalletServiceTicketCodeTests : IDisposable
{
    private const int SpectatorId = 1;
    private const int WalletStartBalance = 1000;
    private const int CodePoints = 300;
    private const string ValidCode = "TICKET-ABC-123";

    private readonly SqliteConnection _conn;

    public WalletServiceTicketCodeTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        using var ctx = NewContext();
        ctx.Database.EnsureCreated();
    }

    private HRTMSDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<HRTMSDbContext>()
            .UseSqlite(_conn)
            .Options;
        return new HRTMSDbContext(options);
    }

    private static byte[] Hash(string code) => SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim()));

    private WalletService NewService(HRTMSDbContext ctx) => new(ctx, new NoOpAuditLog());

    /// <summary>Seed User + Spectator + Wallet + (tuỳ chọn) 1 ticket code.</summary>
    private void Seed(bool withWallet = true, string? status = "Active", DateTime? expiresAt = null, string code = ValidCode)
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;

        ctx.Users.Add(new User
        {
            UserId = SpectatorId,
            Username = "spec1",
            FullName = "Spectator One",
            Email = "spec1@test.local",
            NormalizedEmail = "SPEC1@TEST.LOCAL",
            PasswordHash = "x",
            Role = "Spectator",
            Status = "Active",
            CreatedAt = now,
            UpdatedAt = now
        });
        ctx.SpectatorProfiles.Add(new SpectatorProfile { SpectatorId = SpectatorId, CreatedAt = now });
        if (withWallet)
            ctx.Wallets.Add(new Wallet { SpectatorId = SpectatorId, Balance = WalletStartBalance, UpdatedAt = now });

        if (status != null)
            ctx.TicketRewardCodes.Add(new TicketRewardCode
            {
                CodeHash = Hash(code),
                PointAmount = CodePoints,
                Status = status,
                ExpiresAt = expiresAt ?? now.AddDays(7),
                CreatedAt = now
            });

        ctx.SaveChanges();
    }

    [Fact]
    public async Task Redeem_ValidCode_CreditsWalletAndWritesLedgerOnce()
    {
        Seed();

        RedeemTicketCodeResponseDto data;
        using (var ctx = NewContext())
        {
            var result = await NewService(ctx).RedeemTicketCodeAsync(
                SpectatorId, new RedeemTicketCodeDto { Code = ValidCode }, null);
            Assert.True(result.Success, result.Message);
            data = result.Data!;
        }

        Assert.Equal(CodePoints, data.PointsAdded);
        Assert.Equal(WalletStartBalance + CodePoints, data.NewBalance);

        using var verify = NewContext();
        var wallet = await verify.Wallets.FirstAsync(w => w.SpectatorId == SpectatorId);
        Assert.Equal(WalletStartBalance + CodePoints, wallet.Balance);

        var code = await verify.TicketRewardCodes.FirstAsync();
        Assert.Equal("Redeemed", code.Status);
        Assert.Equal(SpectatorId, code.RedeemedBySpectatorId);
        Assert.NotNull(code.RedeemedAt);

        var txns = await verify.VirtualPointsTransactions
            .Where(t => t.Type == "Ticket Code Bonus").ToListAsync();
        var txn = Assert.Single(txns);
        Assert.Equal(CodePoints, txn.Amount);
        Assert.Equal("TicketRewardCode", txn.ReferenceType);
        Assert.Equal(code.TicketRewardCodeId.ToString(), txn.ReferenceId);
    }

    [Fact]
    public async Task Redeem_NonexistentCode_Fails()
    {
        Seed(status: null); // seed user+wallet nhưng không có code nào

        using var ctx = NewContext();
        var result = await NewService(ctx).RedeemTicketCodeAsync(
            SpectatorId, new RedeemTicketCodeDto { Code = "KHONG-TON-TAI" }, null);

        Assert.False(result.Success);
        Assert.Contains("không tồn tại", result.Message);
    }

    [Fact]
    public async Task Redeem_ExpiredCode_Fails_NoCredit()
    {
        Seed(expiresAt: DateTime.UtcNow.AddDays(-1));

        using (var ctx = NewContext())
        {
            var result = await NewService(ctx).RedeemTicketCodeAsync(
                SpectatorId, new RedeemTicketCodeDto { Code = ValidCode }, null);
            Assert.False(result.Success);
            Assert.Contains("hết hạn", result.Message);
        }

        using var verify = NewContext();
        Assert.Equal(WalletStartBalance, (await verify.Wallets.FirstAsync()).Balance);
        Assert.Equal("Active", (await verify.TicketRewardCodes.FirstAsync()).Status);
        Assert.Empty(verify.VirtualPointsTransactions);
    }

    [Fact]
    public async Task Redeem_AlreadyUsedCode_Fails()
    {
        Seed(status: "Redeemed");

        using var ctx = NewContext();
        var result = await NewService(ctx).RedeemTicketCodeAsync(
            SpectatorId, new RedeemTicketCodeDto { Code = ValidCode }, null);

        Assert.False(result.Success);
        Assert.Contains("đã được sử dụng", result.Message);
    }

    [Fact]
    public async Task Redeem_SameCodeTwice_CreditsOnlyOnce()
    {
        Seed();

        using (var ctx1 = NewContext())
        {
            var r1 = await NewService(ctx1).RedeemTicketCodeAsync(
                SpectatorId, new RedeemTicketCodeDto { Code = ValidCode }, null);
            Assert.True(r1.Success, r1.Message);
        }
        using (var ctx2 = NewContext())
        {
            var r2 = await NewService(ctx2).RedeemTicketCodeAsync(
                SpectatorId, new RedeemTicketCodeDto { Code = ValidCode }, null);
            Assert.False(r2.Success); // code đã Redeemed → không cộng lần hai
        }

        using var verify = NewContext();
        Assert.Equal(WalletStartBalance + CodePoints, (await verify.Wallets.FirstAsync()).Balance);
        Assert.Single(await verify.VirtualPointsTransactions.ToListAsync());
    }

    [Fact]
    public async Task Redeem_WalletMissing_RollsBack_CodeStaysActive()
    {
        Seed(withWallet: false);

        using (var ctx = NewContext())
        {
            var result = await NewService(ctx).RedeemTicketCodeAsync(
                SpectatorId, new RedeemTicketCodeDto { Code = ValidCode }, null);
            Assert.False(result.Success);
            Assert.Contains("Không tìm thấy ví", result.Message);
        }

        // Transaction rollback: code KHÔNG bị đánh dấu Redeemed, không có ledger.
        using var verify = NewContext();
        var code = await verify.TicketRewardCodes.FirstAsync();
        Assert.Equal("Active", code.Status);
        Assert.Null(code.RedeemedBySpectatorId);
        Assert.Empty(verify.VirtualPointsTransactions);
    }

    public void Dispose() => _conn.Dispose();

    private sealed class NoOpAuditLog : IAuditLogService
    {
        public Task LogAsync(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
            => Task.CompletedTask;

        public void LogDeferred(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
        { }
    }
}
