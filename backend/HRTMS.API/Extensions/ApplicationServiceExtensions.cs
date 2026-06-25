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
        services.AddScoped<IHorseService, HorseService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IRaceEntryService, RaceEntryService>();
        services.AddScoped<IRefereeAssignmentService, RefereeAssignmentService>();
        services.AddScoped<IDoctorAssignmentService, DoctorAssignmentService>();
        services.AddScoped<IMedicalCheckService, MedicalCheckService>();
        services.AddScoped<IPursePayoutService, PursePayoutService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IPredictionService, PredictionService>();
        services.AddScoped<IReconciliationService, ReconciliationService>();
        services.AddScoped<IIndependenceCheckService, IndependenceCheckService>();
        services.AddScoped<IEmergencyDisqualificationService, EmergencyDisqualificationService>();
        services.AddScoped<IStartingListService, StartingListService>();
        return services;
    }
}
