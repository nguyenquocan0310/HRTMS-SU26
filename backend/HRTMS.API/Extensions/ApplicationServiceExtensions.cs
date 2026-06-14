using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Services;

namespace HRTMS.API.Extensions;

public static class ApplicationServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<JwtService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAuditLogService, AuditLogService>(); 
        services.AddScoped<ITournamentServices, TournamentSevice>();
        return services;
    }
}