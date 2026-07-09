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
        recurring.AddOrUpdate<IRaceEntryService>(
            "auto-cancel-overdue-entries",
            svc => svc.AutoCancelOverdueAsync(),
            "*/15 * * * *");
    }
}
