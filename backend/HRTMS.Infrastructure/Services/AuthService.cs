
using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.DTOs.FamilyDeclaration;
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
    private readonly IFamilyDeclarationValidator _frdValidator;

    private static readonly string[] AllowedRoles =
        ["Spectator", "Owner", "Jockey", "Referee", "Doctor"];

    // Role được phép khai báo FRD tại bước Register (EC-18)
    // Doctor KHÔNG khai lúc Register — khai sau tại Dashboard (UI-S30)
    private static readonly string[] RolesRequireFrdAtRegister = ["Jockey", "Referee"];

    // Role hợp lệ của người thân được khai báo
    private static readonly string[] IndustryRoles = ["Owner", "Jockey", "Referee", "Doctor"];

    private static readonly string[] ValidRelationTypes = ["Spouse", "Parent", "Child", "Sibling"];

    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 30;

    public AuthService(
       HRTMSDbContext context,
       JwtService jwtService,
       IAuditLogService auditLog,
       IFamilyDeclarationValidator frdValidator)
    {
        _context = context;
        _jwtService = jwtService;
        _auditLog = auditLog;
        _frdValidator = frdValidator;
    }

    // =========================================================
    // LOGIN — không đổi logic, giữ nguyên
    // =========================================================
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

    // =========================================================
    // REGISTER — bổ sung FRD + sửa 3 vấn đề cũ
    // =========================================================
    public async Task<ApiResponse<int>> RegisterAsync(RegisterDto dto, string? ipAddress)
    {
        if (dto.Role == "Admin")
            return ApiResponse<int>.Fail("Không thể tự đăng ký tài khoản Admin.");

        if (!AllowedRoles.Contains(dto.Role))
            return ApiResponse<int>.Fail(
                $"Role không hợp lệ. Các role được phép: {string.Join(", ", AllowedRoles)}.");

        if (await _context.Users.AnyAsync(u => u.Email == dto.Email || u.Username == dto.Username))
            return ApiResponse<int>.Fail("Email hoặc Username đã tồn tại.");

        if (dto.FamilyDeclarations != null && dto.FamilyDeclarations.Count > 0)
        {
            var frdValidation = await _frdValidator.ValidateAsync(
                dto.FamilyDeclarations, declarantUserId: 0 /* chưa có UserId */, isRegister: true);
            if (frdValidation != null)
                return ApiResponse<int>.Fail(frdValidation);
        }
        string initialStatus = dto.Role is "Spectator" or "Owner" ? "Active" : "Pending";
        var now = DateTime.UtcNow;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // ---- Bước 1: Tạo User ----
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
            await _context.SaveChangesAsync(); // cần UserId để dùng ở bước sau

            // ---- Bước 2: Tạo Profile tương ứng Role ----
            switch (dto.Role)
            {
                case "Spectator":
                    // EC-47/BR-56: Tạo Profile + Wallet + VPT SignupBonus nguyên tử trong 1 SaveChanges
                    // Fix: code cũ gọi SaveChangesAsync() 3 lần rời rạc → không đảm bảo nguyên tử
                    var spectatorProfile = new SpectatorProfile
                    {
                        SpectatorId = user.UserId,
                        CreatedAt = now
                    };
                    _context.SpectatorProfiles.Add(spectatorProfile);

                    var wallet = new Wallet
                    {
                        SpectatorId = user.UserId,
                        Balance = 1000,  // set luôn 1000 — khớp với VPT dưới đây
                        UpdatedAt = now
                    };
                    _context.Wallets.Add(wallet);

                    // Thêm VPT cùng lúc — Balance=1000 = SUM(VPT.Amount=1000) ✓
                    // Lưu ý: WalletId chưa có (wallet chưa Insert) → EF Core sẽ resolve FK
                    // tự động vì wallet và VPT được track cùng context trong 1 SaveChanges.
                    _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
                    {
                        Wallet = wallet, // dùng navigation thay vì WalletId để EF tự resolve
                        Amount = 1000,
                        Type = "SignUp Bonus",
                        CreatedAt = now
                    });

                    await _context.SaveChangesAsync(); // 1 lần duy nhất cho cả 3 entity
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
                        BloodType = dto.BloodType,     // thêm mới
                        HealthStatus = dto.HealthStatus ?? "Good", // thêm mới, default "Good"
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

            // ---- Bước 3: Tạo FRD nếu có (chỉ Jockey/Referee tại bước Register) ----
            if (RolesRequireFrdAtRegister.Contains(dto.Role)
                && dto.FamilyDeclarations != null
                && dto.FamilyDeclarations.Count > 0)
            {
                var frdEntities = dto.FamilyDeclarations.Select(f => new FamilyRelationshipDeclaration
                {
                    DeclarantUserId = user.UserId,
                    RelatedPersonName = f.RelatedPersonName.Trim(),
                    RelatedUserId = f.RelatedUserId,
                    RelationType = f.RelationType,
                    IndustryRole = f.IndustryRole,
                    Notes = f.Notes,
                    DeclaredAt = now
                }).ToList();

                _context.FamilyRelationshipDeclarations.AddRange(frdEntities);
                await _context.SaveChangesAsync();
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

    