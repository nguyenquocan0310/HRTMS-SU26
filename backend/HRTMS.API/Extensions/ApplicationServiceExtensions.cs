using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Services;

namespace HRTMS.API.Extensions;

public static class ApplicationServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<JwtService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IFamilyDeclarationValidator, FamilyDeclarationValidator>();
        services.AddScoped<IFamilyDeclarationService, FamilyDeclarationService>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<ITournamentServices, TournamentSevice>();
        services.AddScoped<ITokenBlacklistService, TokenBlacklistService>();
        services.AddScoped<IJockeyService, JockeyService>();
        services.AddScoped<IPairingService, PairingService>();
        services.AddScoped<IResultService, ResultService>();
        return services;
    }
}
