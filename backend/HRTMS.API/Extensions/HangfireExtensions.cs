using Hangfire;
using Hangfire.SqlServer;
using HRTMS.Core.Interfaces.Services;

namespace HRTMS.API.Extensions;

// Module E — job nén Hangfire tự động cancel các RaceEntry quá Confirmation Cut-off.
public static class HangfireExtensions
{
    public static IServiceCollection AddHangfireJobs(
        this IServiceCollection services, IConfiguration config)
    {
        // Tai dung connection string cua DbContext (DefaultConnection).
        var connectionString = config.GetConnectionString("DefaultConnection");

        services.AddHangfire(cfg => cfg
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseSqlServerStorage(connectionString, new SqlServerStorageOptions
            {
                // Hangfire tu tao bang rieng (HangFire schema) trong SQL Server.
                PrepareSchemaIfNecessary = true,
                QueuePollInterval = TimeSpan.FromSeconds(15)
            }));

        services.AddHangfireServer();

        return services;
    }

    // Dang ky recurring job; goi sau khi app da build.
    public static void UseHangfireRecurringJobs(this IApplicationBuilder app)
    {
        var recurring = app.ApplicationServices
            .GetRequiredService<IRecurringJobManager>();

        // Chạy mỗi 15 phút: cancel các entry quá hạn chưa xác nhận.
        // DEPRECATED cùng flow Owner tự confirm entry — giữ để không vỡ dữ liệu cũ
        // đang chờ; entry mới do auto-allocate tạo ra đã ở trạng thái Confirmed nên
        // job này không chạm tới.
        recurring.AddOrUpdate<IRaceEntryService>(
            "auto-cancel-overdue-entries",
            svc => svc.AutoCancelOverdueAsync(),
            "*/15 * * * *");

        // Mỗi giờ: quá PaymentDeadline mà chưa hoàn tất lệ phí -> Pairing Declined.
        recurring.AddOrUpdate<IEntryFeePaymentService>(
            "fee-deadline-job",
            svc => svc.RejectOverduePairingsAsync(),
            "0 * * * *");

        // Mỗi giờ (lệch 10 phút so với fee-deadline-job để pairing quá hạn đã được
        // xử lý xong trước khi chốt pool): auto-allocate vòng 1 của giải đã quá hạn
        // nộp phí. Idempotent — vòng đã allocate bị bỏ qua.
        recurring.AddOrUpdate<IRaceEntryService>(
            "auto-allocate-job",
            svc => svc.AutoAllocateDueRoundsAsync(),
            "10 * * * *");

        // Mỗi giờ (phút thứ 20, sau auto-allocate-job): bốc thăm race Upcoming còn
        // <= 24h là tới giờ chạy. Dùng CHUNG DrawPostPositionsAsync với manual draw
        // nên guard giống hệt; race đã bốc trả ALREADY_DRAWN và được bỏ qua.
        recurring.AddOrUpdate<IRaceEntryService>(
            "auto-draw-job",
            svc => svc.AutoDrawDueRacesAsync(),
            "20 * * * *");
    }
}
