using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using HRTMS.API.Controllers;
using HRTMS.Core.DTOs.Wallet;
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
/// Admin batch creation của TicketRewardCode (BR-63) + luồng end-to-end create → redeem.
/// SQLite in-memory để test đúng transaction. Authorization test bằng reflection trên attribute
/// (guard `[Authorize(Roles="Admin")]` là khai báo ở tầng controller, framework enforce).
/// </summary>
public sealed class AdminTicketCodeTests : IDisposable
{
    private const int AdminId = 99;
    private const int SpectatorId = 1;
    private const int WalletStartBalance = 1000;

    private readonly SqliteConnection _conn;

    public AdminTicketCodeTests()
    {
        _conn = new SqliteConnection("DataSource=:memory:");
        _conn.Open();
        using var ctx = NewContext();
        ctx.Database.EnsureCreated();
    }

    private HRTMSDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<HRTMSDbContext>().UseSqlite(_conn).Options;
        return new HRTMSDbContext(options);
    }

    private WalletService NewService(HRTMSDbContext ctx) => new(ctx, new NoOpAuditLog());

    private static byte[] Hash(string code) => SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim()));

    private void SeedSpectatorWallet()
    {
        using var ctx = NewContext();
        var now = DateTime.UtcNow;
        ctx.Users.Add(new User
        {
            UserId = SpectatorId, Username = "spec1", FullName = "Spectator One",
            Email = "spec1@test.local", NormalizedEmail = "SPEC1@TEST.LOCAL",
            PasswordHash = "x", Role = "Spectator", Status = "Active",
            CreatedAt = now, UpdatedAt = now
        });
        ctx.SpectatorProfiles.Add(new SpectatorProfile { SpectatorId = SpectatorId, CreatedAt = now });
        ctx.Wallets.Add(new Wallet { SpectatorId = SpectatorId, Balance = WalletStartBalance, UpdatedAt = now });
        ctx.SaveChanges();
    }

    private CreateTicketCodesDto Dto(int quantity, int reward = 200, DateTime? expiresAt = null)
        => new() { Quantity = quantity, RewardAmount = reward, ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(30) };

    [Fact]
    public async Task Create_SingleCode_PersistsHashOnly()
    {
        CreateTicketCodesResponseDto data;
        using (var ctx = NewContext())
        {
            var result = await NewService(ctx).CreateTicketCodesAsync(AdminId, Dto(1), null);
            Assert.True(result.Success, result.Message);
            data = result.Data!;
        }

        Assert.Equal(1, data.Count);
        var raw = Assert.Single(data.Codes);
        Assert.StartsWith("TKT-", raw);

        using var verify = NewContext();
        var code = await verify.TicketRewardCodes.SingleAsync();
        Assert.Equal("Active", code.Status);
        Assert.Equal(200, code.PointAmount);
        Assert.Null(code.RedeemedBySpectatorId);
        // DB chỉ lưu hash: CodeHash == SHA256(raw), và không có cột nào chứa raw string.
        Assert.Equal(Hash(raw), code.CodeHash);
        Assert.Equal(32, code.CodeHash.Length);
    }

    [Fact]
    public async Task Create_Batch_GeneratesDistinctCodesAndRows()
    {
        const int qty = 25;
        CreateTicketCodesResponseDto data;
        using (var ctx = NewContext())
        {
            var result = await NewService(ctx).CreateTicketCodesAsync(AdminId, Dto(qty, reward: 150), null);
            Assert.True(result.Success, result.Message);
            data = result.Data!;
        }

        Assert.Equal(qty, data.Count);
        Assert.Equal(qty, data.Codes.Count);
        Assert.Equal(qty, data.Codes.Distinct().Count());        // raw code không trùng trong batch
        Assert.All(data.Codes, c => Assert.Equal(150, data.RewardAmount));

        using var verify = NewContext();
        var codes = await verify.TicketRewardCodes.ToListAsync();
        Assert.Equal(qty, codes.Count);
        Assert.Equal(qty, codes.Select(c => Convert.ToBase64String(c.CodeHash)).Distinct().Count()); // hash không trùng
        Assert.All(codes, c => Assert.Equal("Active", c.Status));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(1001)]
    public async Task Create_InvalidQuantity_Fails_NoRows(int qty)
    {
        using (var ctx = NewContext())
        {
            var result = await NewService(ctx).CreateTicketCodesAsync(AdminId, Dto(qty), null);
            Assert.False(result.Success);
        }
        using var verify = NewContext();
        Assert.Equal(0, await verify.TicketRewardCodes.CountAsync()); // không ghi từng phần
    }

    [Fact]
    public async Task Create_InvalidRewardOrExpiry_Fails()
    {
        using var ctx = NewContext();
        var svc = NewService(ctx);

        var badReward = await svc.CreateTicketCodesAsync(AdminId, Dto(1, reward: 0), null);
        Assert.False(badReward.Success);

        var badExpiry = await svc.CreateTicketCodesAsync(
            AdminId, Dto(1, expiresAt: DateTime.UtcNow.AddDays(-1)), null);
        Assert.False(badExpiry.Success);
    }

    [Fact]
    public async Task CreateThenRedeem_EndToEnd_CreditsWalletAndLedger()
    {
        SeedSpectatorWallet();

        string raw;
        using (var ctx = NewContext())
        {
            var created = await NewService(ctx).CreateTicketCodesAsync(AdminId, Dto(3, reward: 250), null);
            Assert.True(created.Success, created.Message);
            raw = created.Data!.Codes[0];
        }

        using (var ctx = NewContext())
        {
            var redeem = await NewService(ctx).RedeemTicketCodeAsync(
                SpectatorId, new RedeemTicketCodeDto { Code = raw }, null);
            Assert.True(redeem.Success, redeem.Message);
            Assert.Equal(250, redeem.Data!.PointsAdded);
            Assert.Equal(WalletStartBalance + 250, redeem.Data.NewBalance);
        }

        using var verify = NewContext();
        Assert.Equal(WalletStartBalance + 250, (await verify.Wallets.FirstAsync()).Balance);
        var txn = Assert.Single(await verify.VirtualPointsTransactions
            .Where(t => t.Type == "Ticket Code Bonus").ToListAsync());
        Assert.Equal(250, txn.Amount);
        Assert.Equal("TicketRewardCode", txn.ReferenceType);
    }

    [Fact]
    public async Task CreateThenRedeemTwice_SecondRejected()
    {
        SeedSpectatorWallet();

        string raw;
        using (var ctx = NewContext())
            raw = (await NewService(ctx).CreateTicketCodesAsync(AdminId, Dto(1), null)).Data!.Codes[0];

        using (var ctx = NewContext())
            Assert.True((await NewService(ctx).RedeemTicketCodeAsync(
                SpectatorId, new RedeemTicketCodeDto { Code = raw }, null)).Success);

        using (var ctx = NewContext())
            Assert.False((await NewService(ctx).RedeemTicketCodeAsync(
                SpectatorId, new RedeemTicketCodeDto { Code = raw }, null)).Success);

        using var verify = NewContext();
        Assert.Equal(WalletStartBalance + 200, (await verify.Wallets.FirstAsync()).Balance); // cộng đúng một lần
    }

    [Fact]
    public void AdminController_RequiresAdminRole()
    {
        // Guard authorization là khai báo: [Authorize(Roles = "Admin")] trên controller.
        var attr = typeof(AdminTicketCodeController)
            .GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(attr);
        Assert.Equal("Admin", attr!.Roles);
    }

    [Fact]
    public void NoEndpoint_ReturnsRawCode_AfterCreation()
    {
        // Chỉ endpoint tạo batch trả raw code (List<string> Codes). Không có action GET nào
        // trên controller ticket-code lộ raw code lại.
        var getActions = typeof(AdminTicketCodeController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes().Any(a =>
                a.GetType().Name.StartsWith("HttpGet")))
            .ToList();
        Assert.Empty(getActions);
    }

    public void Dispose() => _conn.Dispose();

    private sealed class NoOpAuditLog : IAuditLogService
    {
        public Task LogAsync(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null)
            => Task.CompletedTask;
        public void LogDeferred(int actorId, string action, string entityName, string entityId,
            string? oldValue = null, string? newValue = null, string? ipAddress = null, string? userAgent = null) { }
    }
}
