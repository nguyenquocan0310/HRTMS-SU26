using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.DTOs.FamilyDeclaration;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HRTMS.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly HRTMSDbContext _context;
    private readonly JwtService _jwtService;
    private readonly IAuditLogService _auditLog;
    private readonly IFamilyDeclarationValidator _frdValidator;
    private readonly ITokenBlacklistService _tokenBlacklistService;
    private readonly byte[] _encryptionKey; // 32 bytes — AES-256

    // ACC.1 — các role được phép tự đăng ký
    private static readonly string[] AllowedSelfRegisterRoles =
        ["Spectator", "Owner", "Jockey", "Referee", "Doctor"];

    // ACC.2 — Admin tạo được thêm role Admin
    private static readonly string[] AllAllowedRoles =
        ["Spectator", "Owner", "Jockey", "Referee", "Doctor", "Admin"];

    // ACC.1A — các role bắt buộc có định danh đầy đủ
    private static readonly string[] ProfessionalRoles =
        ["Owner", "Jockey", "Referee", "Doctor"];

    // Role được phép khai báo FRD tại bước Register (EC-18)
    private static readonly string[] RolesRequireFrdAtRegister = ["Jockey", "Referee"];

    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 30;

    // ACC.1 CCCD — chỉ chấp nhận đúng 12 số
    private static readonly Regex CccdRegex = new(@"^\d{12}$", RegexOptions.Compiled);

    public AuthService(
        HRTMSDbContext context,
        JwtService jwtService,
        IAuditLogService auditLog,
        IFamilyDeclarationValidator frdValidator,
        ITokenBlacklistService tokenBlacklistService,
        IConfiguration configuration)
    {
        _context = context;
        _jwtService = jwtService;
        _auditLog = auditLog;
        _frdValidator = frdValidator;
        _tokenBlacklistService = tokenBlacklistService;

        // Đọc key từ config; fallback dev-only key (KHÔNG dùng trong production)
        var keyHex = configuration["Security:IdentityEncryptionKeyHex"];
        if (!string.IsNullOrEmpty(keyHex) && keyHex.Length == 64)
            _encryptionKey = Convert.FromHexString(keyHex);
        else
            _encryptionKey = new byte[32]; // all-zeros — dev only, override qua appsettings
    }

    // =========================================================
    // LOGIN
    // =========================================================
    public async Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto dto, string? ipAddress)
    {
        // normalize email trước khi lookup
        var email = dto.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

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
            ipAddress: ipAddress);

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
    // REGISTER — tự đăng ký (không bao gồm Admin)
    // =========================================================
    public async Task<ApiResponse<int>> RegisterAsync(RegisterDto dto, string? ipAddress)
    {
        if (dto.Role == "Admin")
            return ApiResponse<int>.Fail("Không thể tự đăng ký tài khoản Admin.");

        if (!AllowedSelfRegisterRoles.Contains(dto.Role))
            return ApiResponse<int>.Fail(
                $"Role không hợp lệ. Các role được phép: {string.Join(", ", AllowedSelfRegisterRoles)}.");

        // ACC.1A.1 — bắt buộc định danh đầy đủ cho professional roles
        if (ProfessionalRoles.Contains(dto.Role))
        {
            var identityError = ValidateProfessionalIdentity(
                dto.PhoneNumber, dto.DateOfBirth, dto.IdentityNumber, dto.Role);
            if (identityError != null)
                return ApiResponse<int>.Fail(identityError);
        }

        // normalize email + phone trước khi check duplicate / lưu
        var normalizedEmail = dto.Email.Trim().ToLower();
        var normalizedPhone = dto.PhoneNumber?.Trim();

        if (await _context.Users.AnyAsync(u => u.Email == normalizedEmail || u.Username == dto.Username))
            return ApiResponse<int>.Fail("Email hoặc Username đã tồn tại.");

        // validate FRD nếu có
        if (dto.FamilyDeclarations != null && dto.FamilyDeclarations.Count > 0)
        {
            var frdValidation = await _frdValidator.ValidateAsync(
                dto.FamilyDeclarations, declarantUserId: 0, isRegister: true);
            if (frdValidation != null)
                return ApiResponse<int>.Fail(frdValidation);
        }

        // ACC.1.6 — Owner → Active ngay; Spectator → Active; Jockey/Referee/Doctor → Pending
        string initialStatus = dto.Role is "Spectator" or "Owner" ? "Active" : "Pending";

        // Prepare identity encryption nếu có CCCD
        byte[]? encrypted = null;
        byte[]? hash = null;
        if (!string.IsNullOrEmpty(dto.IdentityNumber))
            (encrypted, hash) = EncryptIdentity(dto.IdentityNumber);

        // Kiểm tra CCCD trùng (identity hash unique)
        if (hash != null && await _context.Users.AnyAsync(u => u.IdentityHash != null && u.IdentityHash == hash))
            return ApiResponse<int>.Fail("Số CCCD đã được đăng ký với tài khoản khác.");

        var now = DateTime.UtcNow;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var user = new User
            {
                Username = dto.Username,
                FullName = dto.FullName,
                Email = normalizedEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password, workFactor: 12),
                Role = dto.Role,
                Status = initialStatus,
                PhoneNumber = normalizedPhone,
                DateOfBirth = dto.DateOfBirth,
                IdentityNumberEncrypted = encrypted,
                IdentityHash = hash,
                FailedLoginAttempts = 0,
                CreatedAt = now,
                UpdatedAt = now
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await CreateRoleProfileAsync(user.UserId, dto.Role, dto, now);

            // FRD
            if (RolesRequireFrdAtRegister.Contains(dto.Role)
                && dto.FamilyDeclarations != null
                && dto.FamilyDeclarations.Count > 0)
            {
                _context.FamilyRelationshipDeclarations.AddRange(
                    dto.FamilyDeclarations.Select(f => new FamilyRelationshipDeclaration
                    {
                        DeclarantUserId = user.UserId,
                        RelatedPersonName = f.RelatedPersonName.Trim(),
                        RelatedUserId = f.RelatedUserId,
                        RelationType = f.RelationType,
                        IndustryRole = f.IndustryRole,
                        Notes = f.Notes,
                        DeclaredAt = now
                    }));
                await _context.SaveChangesAsync();
            }

            await transaction.CommitAsync();

            await _auditLog.LogAsync(
                actorId: user.UserId,
                action: "Register",
                entityName: "Users",
                entityId: user.UserId.ToString(),
                ipAddress: ipAddress);

            return ApiResponse<int>.Ok(user.UserId, "Tạo tài khoản thành công.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // =========================================================
    // ACC.2 — Admin tạo tài khoản (bao gồm Admin)
    // =========================================================
    public async Task<ApiResponse<int>> AdminCreateUserAsync(
        AdminCreateUserDto dto, int adminId, string? ipAddress)
    {
        if (!AllAllowedRoles.Contains(dto.Role))
            return ApiResponse<int>.Fail(
                $"Role không hợp lệ. Các role được phép: {string.Join(", ", AllAllowedRoles)}.");

        // professional roles bắt buộc định danh đầy đủ
        if (ProfessionalRoles.Contains(dto.Role))
        {
            var identityError = ValidateProfessionalIdentity(
                dto.PhoneNumber, dto.DateOfBirth, dto.IdentityNumber, dto.Role);
            if (identityError != null)
                return ApiResponse<int>.Fail(identityError);
        }

        var normalizedEmail = dto.Email.Trim().ToLower();
        var normalizedPhone = dto.PhoneNumber?.Trim();

        if (await _context.Users.AnyAsync(u => u.Email == normalizedEmail || u.Username == dto.Username))
            return ApiResponse<int>.Fail("Email hoặc Username đã tồn tại.");

        byte[]? encrypted = null;
        byte[]? hash = null;
        if (!string.IsNullOrEmpty(dto.IdentityNumber))
            (encrypted, hash) = EncryptIdentity(dto.IdentityNumber);

        if (hash != null && await _context.Users.AnyAsync(u => u.IdentityHash != null && u.IdentityHash == hash))
            return ApiResponse<int>.Fail("Số CCCD đã được đăng ký với tài khoản khác.");

        // Admin tạo → Active ngay với mọi role (trừ Jockey/Referee/Doctor cần profile approval)
        // Rule: Admin tạo Jockey/Referee/Doctor vẫn cần Admin duyệt profile → Pending; Admin tạo Admin/Owner/Spectator → Active
        string initialStatus = dto.Role is "Jockey" or "Referee" or "Doctor" ? "Pending" : "Active";

        var now = DateTime.UtcNow;

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var user = new User
            {
                Username = dto.Username,
                FullName = dto.FullName,
                Email = normalizedEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password, workFactor: 12),
                Role = dto.Role,
                Status = initialStatus,
                PhoneNumber = normalizedPhone,
                DateOfBirth = dto.DateOfBirth,
                IdentityNumberEncrypted = encrypted,
                IdentityHash = hash,
                FailedLoginAttempts = 0,
                CreatedAt = now,
                UpdatedAt = now
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Tạo profile bằng RegisterDto-compatible helper (reuse)
            var registerDto = new RegisterDto
            {
                Role = dto.Role,
                LicenseCertificate = dto.LicenseCertificate,
                ExperienceYears = dto.ExperienceYears,
                SelfDeclaredWeight = dto.SelfDeclaredWeight,
                BloodType = dto.BloodType,
                HealthStatus = dto.HealthStatus,
                CertificationLevel = dto.CertificationLevel,
                MedicalLicenseNumber = dto.MedicalLicenseNumber
            };
            await CreateRoleProfileAsync(user.UserId, dto.Role, registerDto, now);

            await transaction.CommitAsync();

            await _auditLog.LogAsync(
                actorId: adminId,
                action: "Admin_Create_User",
                entityName: "Users",
                entityId: user.UserId.ToString(),
                newValue: $"Role={dto.Role}, Status={initialStatus}, Email={normalizedEmail}",
                ipAddress: ipAddress);

            return ApiResponse<int>.Ok(user.UserId, "Tạo tài khoản thành công.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // =========================================================
    // LOGOUT
    // =========================================================
    public async Task<ApiResponse<bool>> LogoutAsync(int userId, string? ipAddress)
    {
        await _tokenBlacklistService.BlacklistUserAsync(userId);

        await _auditLog.LogAsync(
            actorId: userId,
            action: "Logout",
            entityName: "Users",
            entityId: userId.ToString(),
            ipAddress: ipAddress);

        return ApiResponse<bool>.Ok(true, "Đăng xuất thành công.");
    }

    // =========================================================
    // PRIVATE HELPERS
    // =========================================================

    /// <summary>
    /// ACC.1A — Validate định danh bắt buộc cho professional roles.
    /// Trả về chuỗi lỗi nếu không hợp lệ, null nếu OK.
    /// </summary>
    private static string? ValidateProfessionalIdentity(
        string? phone, DateTime? dob, string? cccd, string role)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return $"Role {role} bắt buộc phải cung cấp số điện thoại.";

        if (dob == null)
            return $"Role {role} bắt buộc phải cung cấp ngày sinh.";

        if (string.IsNullOrWhiteSpace(cccd))
            return $"Role {role} bắt buộc phải cung cấp số CCCD.";

        // ACC chốt: CCCD = đúng 12 số (không chấp nhận CMND 9 số)
        if (!CccdRegex.IsMatch(cccd.Trim()))
            return "Số CCCD không hợp lệ. CCCD phải gồm đúng 12 chữ số.";

        return null;
    }

    /// <summary>
    /// Mã hoá CCCD plain-text bằng AES-256-CBC.
    /// Trả về (encrypted, sha256Hash).
    /// Hash dùng để lookup/unique check mà không cần decrypt.
    /// </summary>
    private (byte[] encrypted, byte[] hash) EncryptIdentity(string cccd)
    {
        var plain = Encoding.UTF8.GetBytes(cccd.Trim());

        using var aes = Aes.Create();
        aes.Key = _encryptionKey;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var cipherText = encryptor.TransformFinalBlock(plain, 0, plain.Length);

        // Lưu IV + ciphertext để có thể decrypt sau
        var result = new byte[aes.IV.Length + cipherText.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(cipherText, 0, result, aes.IV.Length, cipherText.Length);

        // Hash SHA-256 deterministic để tra cứu unique
        var hash = SHA256.HashData(plain);

        return (result, hash);
    }

    /// <summary>
    /// Tạo profile record tương ứng với role sau khi User đã được SaveChanges.
    /// </summary>
    private async Task CreateRoleProfileAsync(
        int userId, string role, RegisterDto dto, DateTime now)
    {
        switch (role)
        {
            case "Spectator":
                var wallet = new Wallet
                {
                    SpectatorId = userId,
                    Balance = 0,
                    UpdatedAt = now
                };
                _context.SpectatorProfiles.Add(new SpectatorProfile
                {
                    SpectatorId = userId,
                    CreatedAt = now
                });
                _context.Wallets.Add(wallet);
                _context.VirtualPointsTransactions.Add(new VirtualPointsTransaction
                {
                    Wallet = wallet,
                    Amount = 1000,
                    Type = "SignUp Bonus",
                    CreatedAt = now
                });
                await _context.SaveChangesAsync();
                break;

            case "Owner":
                // schema v2: OwnerProfiles chỉ còn OwnerId (identity pindah ke Users)
                _context.OwnerProfiles.Add(new OwnerProfile
                {
                    OwnerId = userId,
                    CreatedAt = now,
                    UpdatedAt = now
                });
                await _context.SaveChangesAsync();
                break;

            case "Jockey":
                _context.JockeyProfiles.Add(new JockeyProfile
                {
                    JockeyId = userId,
                    LicenseCertificate = dto.LicenseCertificate ?? string.Empty,
                    ExperienceYears = dto.ExperienceYears ?? 0,
                    SelfDeclaredWeight = dto.SelfDeclaredWeight ?? 0,
                    BloodType = dto.BloodType,
                    HealthStatus = dto.HealthStatus ?? "Good",
                    Status = "Pending",
                    CreatedAt = now,
                    UpdatedAt = now
                });
                await _context.SaveChangesAsync();
                break;

            case "Referee":
                _context.RefereeProfiles.Add(new RefereeProfile
                {
                    RefereeId = userId,
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
                    DoctorId = userId,
                    MedicalLicenseNumber = dto.MedicalLicenseNumber ?? string.Empty,
                    Status = "Pending",
                    CreatedAt = now,
                    UpdatedAt = now
                });
                await _context.SaveChangesAsync();
                break;

            case "Admin":
                // Admin không có profile riêng
                break;
        }
    }
}