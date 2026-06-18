using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly HRTMSDbContext _context;
    private readonly JwtService _jwtService;
    private readonly IAuditLogService _auditLog;

    private static readonly string[] AllowedRoles =
        ["Spectator", "Owner", "Jockey", "Referee", "Doctor"];
    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 30;

    public AuthService(HRTMSDbContext context, JwtService jwtService,
                       IAuditLogService auditLog)
    {
        _context = context;
        _jwtService = jwtService;
        _auditLog = auditLog;
    }

    public async Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto dto, string? ipAddress)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        if (user == null)
            return ApiResponse<AuthResponseDto>.Fail("Email hoặc mật khẩu không đúng.");

        if (user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTime.UtcNow)
            return ApiResponse<AuthResponseDto>.Fail(
                $"Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau {user.LockoutEnd.Value:HH:mm dd/MM/yyyy} UTC.");

        if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts++;
            if (user.FailedLoginAttempts >= MaxFailedAttempts)
            {
                user.LockoutEnd = DateTime.UtcNow.AddMinutes(LockoutMinutes);
                user.FailedLoginAttempts = 0;
            }
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return ApiResponse<AuthResponseDto>.Fail("Email hoặc mật khẩu không đúng.");
        }

        if (user.Status == "Pending")
            return ApiResponse<AuthResponseDto>.Fail("Tài khoản chưa được Admin phê duyệt.");

        if (user.Status == "Suspended")
            return ApiResponse<AuthResponseDto>.Fail("Tài khoản đã bị vô hiệu hóa.");

        user.FailedLoginAttempts = 0;
        user.LockoutEnd = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _auditLog.LogAsync(
            actorId: user.UserId,
            action: "Login",
            entityName: "Users",
            entityId: user.UserId.ToString(),
            ipAddress: ipAddress
        );

        var token = _jwtService.GenerateToken(user);

        return ApiResponse<AuthResponseDto>.Ok(new AuthResponseDto
        {
            Token = token,
            UserId = user.UserId,
            Role = user.Role,
            FullName = user.FullName
        });
    }

    public async Task<ApiResponse<int>> RegisterAsync(RegisterDto dto, string? ipAddress)
    {
        if (dto.Role == "Admin")
            return ApiResponse<int>.Fail("Không thể tự đăng ký tài khoản Admin.");

        if (!AllowedRoles.Contains(dto.Role))
            return ApiResponse<int>.Fail($"Role không hợp lệ. Các role được phép: {string.Join(", ", AllowedRoles)}.");

        if (await _context.Users.AnyAsync(u => u.Email == dto.Email || u.Username == dto.Username))
            return ApiResponse<int>.Fail("Email hoặc Username đã tồn tại.");

        string initialStatus = dto.Role is "Spectator" or "Owner" ? "Active" : "Pending";

        var now = DateTime.UtcNow;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var user = new User
            {
                Username = dto.Username,
                FullName = dto.FullName,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password, workFactor: 12),
                Role = dto.Role,
                Status = initialStatus,
                FailedLoginAttempts = 0,
                CreatedAt = now,
                UpdatedAt = now
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            switch (dto.Role)
            {
                case "Spectator":
                    var spectatorProfile = new SpectatorProfile
                    {
                        SpectatorId = user.UserId,
                        CreatedAt = now
                    };
                    _context.SpectatorProfiles.Add(spectatorProfile);
                    await _context.SaveChangesAsync();

                    var wallet = new Wallet
                    {
                        SpectatorId = spectatorProfile.SpectatorId,
                        Balance = 0,
                        UpdatedAt = now
                    };
                    _context.Wallets.Add(wallet);
                    await _context.SaveChangesAsync();

                    _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
                    {
                        WalletId = wallet.WalletId,
                        Amount = 1000,
                        Type = "SignUp Bonus",
                        ReferenceId = null,
                        CreatedAt = now
                    });

                    wallet.Balance = 1000;
                    wallet.UpdatedAt = now;
                    await _context.SaveChangesAsync();
                    break;

                case "Owner":
                    _context.OwnerProfiles.Add(new OwnerProfile
                    {
                        OwnerId = user.UserId,
                        PhoneNumber = dto.PhoneNumber ?? string.Empty,
                        IdentityNumber = dto.IdentityNumber ?? string.Empty,
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                    await _context.SaveChangesAsync();
                    break;

                case "Jockey":
                    _context.JockeyProfiles.Add(new JockeyProfile
                    {
                        JockeyId = user.UserId,
                        LicenseCertificate = dto.LicenseCertificate ?? string.Empty,
                        ExperienceYears = dto.ExperienceYears ?? 0,
                        SelfDeclaredWeight = dto.SelfDeclaredWeight ?? 0,
                        Status = "Pending",
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                    await _context.SaveChangesAsync();
                    break;

                case "Referee":
                    _context.RefereeProfiles.Add(new RefereeProfile
                    {
                        RefereeId = user.UserId,
                        CertificationLevel = dto.CertificationLevel ?? string.Empty,
                        Status = "Pending",
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                    await _context.SaveChangesAsync();
                    break;

                case "Doctor":
                    _context.DoctorProfiles.Add(new DoctorProfile
                    {
                        DoctorId = user.UserId,
                        MedicalLicenseNumber = dto.MedicalLicenseNumber ?? string.Empty,
                        Status = "Pending",
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                    await _context.SaveChangesAsync();
                    break;
            }

            await transaction.CommitAsync();

            await _auditLog.LogAsync(
                actorId: user.UserId,
                action: "Register",
                entityName: "Users",
                entityId: user.UserId.ToString(),
                ipAddress: ipAddress
            );

            return ApiResponse<int>.Ok(user.UserId, "Tạo tài khoản thành công.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}