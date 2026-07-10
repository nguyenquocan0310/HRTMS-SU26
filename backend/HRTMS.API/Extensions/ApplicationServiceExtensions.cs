using HRTMS.Core.Interfaces.Services;
using HRTMS.Core.Models;
using HRTMS.Infrastructure.Services;
using Microsoft.Extensions.Configuration;

namespace HRTMS.API.Extensions;

public static class ApplicationServiceExtensions
{

    public static IServiceCollection AddApplicationServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddScoped<JwtService>();
        services.AddScoped<IFileStorageService, FileStorageService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IFamilyDeclarationValidator, FamilyDeclarationValidator>();
        services.AddScoped<IFamilyDeclarationService, FamilyDeclarationService>();
        services.AddScoped<IIdentityResolveService, IdentityResolveService>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<ITournamentServices, TournamentSevice>();
        services.AddScoped<ITournamentParticipantService, TournamentParticipantService>();
        services.AddScoped<ITokenBlacklistService, TokenBlacklistService>();
        services.AddScoped<IJockeyService, JockeyService>();
        services.AddScoped<IRefereeService, RefereeService>();
        services.AddScoped<IDoctorService, DoctorService>();
        services.AddScoped<IPairingService, PairingService>();
        services.AddScoped<IResultService, ResultService>();
        services.AddScoped<IHorseService, HorseService>();
        services.AddScoped<INotificationService, NotificationService>();

        // NOTI.2 — SMTP Email: bind SmtpSettings từ appsettings.json
        services.Configure<SmtpSettings>(configuration.GetSection("SmtpSettings"));
        services.AddScoped<IEmailService, EmailService>();

        services.AddScoped<IRaceEntryService, RaceEntryService>();
        services.AddScoped<IRefereeAssignmentService, RefereeAssignmentService>();
        services.AddScoped<IDoctorAssignmentService, DoctorAssignmentService>();
        services.AddScoped<IMedicalCheckService, MedicalCheckService>();
        services.AddScoped<IPursePayoutService, PursePayoutService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IPredictionService, PredictionService>();
        services.AddScoped<IReconciliationService, ReconciliationService>();
        services.AddScoped<IWalletService, WalletService>();
        services.AddScoped<IIndependenceCheckService, IndependenceCheckService>();
        services.AddScoped<IEmergencyDisqualificationService, EmergencyDisqualificationService>();
        services.AddScoped<IStartingListService, StartingListService>();
        return services;
    }
}