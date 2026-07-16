using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using BCrypt.Net;
using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Auth;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace HRTMS.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly HRTMSDbContext _context;
    private readonly JwtService _jwtService;
    private readonly IAuditLogService _auditLog;
    private readonly ITokenBlacklistService _tokenBlacklistService;
    private readonly IEmailService _emailService;
    private readonly INotificationService _notificationService;
    private readonly IFileStorageService _fileStorageService;
    private readonly IConfiguration _config;
    private readonly byte[] _encryptionKey;

    private static readonly string[] AllowedSelfRegisterRoles =
        ["Spectator", "Owner", "Jockey", "Referee", "Doctor"];

    private static readonly string[] AllAllowedRoles =
        ["Spectator", "Owner", "Jockey", "Referee", "Doctor", "Admin"];

    private static readonly string[] ProfessionalRoles =
        ["Owner", "Jockey", "Referee", "Doctor"];

    // Role bắt buộc upload file chứng chỉ/bằng cấp khi đăng ký (ACC.1A).
    private static readonly string[] RolesRequireCertificate =
        ["Jockey", "Referee", "Doctor"];

    private const int MaxFailedAttempts = 5;
    private const int LockoutMinutes = 30;

    private static readonly Regex CccdRegex = new(@"^\d{12}$", RegexOptions.Compiled);

    public AuthService(
        HRTMSDbContext context,
        JwtService jwtService,
        IAuditLogService auditLog,
        ITokenBlacklistService tokenBlacklistService,
        IEmailService emailService,
        INotificationService notificationService,
        IFileStorageService fileStorageService,
        IConfiguration configuration)
    {
        _context = context;
        _jwtService = jwtService;
        _auditLog = auditLog;
        _tokenBlacklistService = tokenBlacklistService;
        _emailService = emailService;
        _notificationService = notificationService;
        _fileStorageService = fileStorageService;
        _config = configuration;

        var keyHex = configuration["Security:IdentityEncryptionKeyHex"];
        if (!string.IsNullOrEmpty(keyHex) && keyHex.Length == 64)
            _encryptionKey = Convert.FromHexString(keyHex);
        else
            _encryptionKey = new byte[32];
    }

    // =========================================================
    // LOGIN
    // =========================================================
    public async Task<ApiResponse<AuthResponseDto>> LoginAsync(LoginDto dto, string? ipAddress, string? userAgent = null)
    {
        var email = dto.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
            return ApiResponse<AuthResponseDto>.Fail("Email hoặc mật khẩu không đúng.");

        // Tài khoản hệ thống (actor cho job tự động — patch 006) không được đăng nhập.
        // Chặn trước bước verify: PasswordHash của user này không phải BCrypt hash hợp lệ.
        if (user.Role == "System")
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
            ipAddress: ipAddress,
            userAgent: userAgent);

        var token = _jwtService.GenerateToken(user);
        return ApiResponse<AuthResponseDto>.Ok(new AuthResponseDto
        {
            Token = token,
            UserId = user.UserId,
            Username = user.Username,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            Status = user.Status
        });
    }

    // =========================================================
    // REGISTER
    // =========================================================
    public async Task<ApiResponse<int>> RegisterAsync(RegisterDto dto, string? ipAddress, string? userAgent = null)
    {
        if (dto.Role == "Admin")
            return ApiResponse<int>.Fail("Không thể tự đăng ký tài khoản Admin.");

        if (!AllowedSelfRegisterRoles.Contains(dto.Role))
            return ApiResponse<int>.Fail(
                $"Role không hợp lệ. Các role được phép: {string.Join(", ", AllowedSelfRegisterRoles)}.");

        if (ProfessionalRoles.Contains(dto.Role))
        {
            var identityError = ValidateProfessionalIdentity(
                dto.PhoneNumber, dto.DateOfBirth, dto.IdentityNumber, dto.Role);
            if (identityError != null)
                return ApiResponse<int>.Fail(identityError);
        }

        if (RolesRequireCertificate.Contains(dto.Role))
        {
            if (dto.CertificateFile == null || dto.CertificateFile.Length == 0)
                return ApiResponse<int>.Fail(
                    $"Role {dto.Role} bắt buộc phải upload file chứng chỉ/bằng cấp.");
        }

        var normalizedEmail = dto.Email.Trim().ToLower();
        var normalizedPhone = dto.PhoneNumber?.Trim();

        if (await _context.Users.AnyAsync(u => u.Email == normalizedEmail || u.Username == dto.Username))
            return ApiResponse<int>.Fail("Email hoặc Username đã tồn tại.");

        // Chặn trùng lặp số điện thoại — chỉ áp dụng khi có nhập SĐT
        // (Spectator có thể không có PhoneNumber).
        if (!string.IsNullOrEmpty(normalizedPhone)
            && await _context.Users.AnyAsync(u => u.PhoneNumber == normalizedPhone))
            return ApiResponse<int>.Fail("Số điện thoại đã được đăng ký với tài khoản khác.");

        // Kiểm tra email có thật (domain tồn tại, có khả năng nhận thư) —
        // [EmailAddress] chỉ check được format, không check domain có tồn tại hay không.
        if (!await IsEmailDomainValidAsync(normalizedEmail))
            return ApiResponse<int>.Fail("Email không hợp lệ hoặc domain email không tồn tại.");

        string initialStatus = dto.Role is "Spectator" or "Owner" ? "Active" : "Pending";

        byte[]? encrypted = null;
        byte[]? hash = null;
        if (!string.IsNullOrEmpty(dto.IdentityNumber))
            (encrypted, hash) = EncryptIdentity(dto.IdentityNumber);

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
                NormalizedEmail = normalizedEmail.ToUpper(),
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

            await CreateRoleProfileAsync(user.UserId, dto.Role, dto, now, dto.CertificateFile);

            await transaction.CommitAsync();

            await _auditLog.LogAsync(
                actorId: user.UserId,
                action: "Register",
                entityName: "Users",
                entityId: user.UserId.ToString(),
                ipAddress: ipAddress,
                userAgent: userAgent);

            // Welcome notify — gửi SAU khi transaction đã commit, không để lỗi email
            // (đã tự catch trong NotificationService/EmailService) ảnh hưởng tới đăng ký.
            var welcomeMessage = initialStatus == "Active"
                ? $"Chào mừng {user.FullName} đến với HRTMS! Tài khoản của bạn đã sẵn sàng sử dụng."
                : $"Chào mừng {user.FullName} đến với HRTMS! Hồ sơ {dto.Role} của bạn đang chờ Admin duyệt, " +
                  "chúng tôi sẽ thông báo ngay khi có kết quả.";

            await _notificationService.SendAsync(
                user.UserId,
                "Chào mừng bạn đến với HRTMS",
                welcomeMessage,
                type: "Both",
                relatedEntityType: "Users",
                relatedEntityId: user.UserId);

            return ApiResponse<int>.Ok(user.UserId, "Tạo tài khoản thành công.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // =========================================================
    // ACC.2 — Admin tạo tài khoản
    // =========================================================
    public async Task<ApiResponse<int>> AdminCreateUserAsync(
        AdminCreateUserDto dto, int adminId, string? ipAddress, string? userAgent = null)
    {
        if (!AllAllowedRoles.Contains(dto.Role))
            return ApiResponse<int>.Fail(
                $"Role không hợp lệ. Các role được phép: {string.Join(", ", AllAllowedRoles)}.");

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
                NormalizedEmail = normalizedEmail.ToUpper(),
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

            var registerDto = new RegisterDto
            {
                Role = dto.Role,
                ExperienceYears = dto.ExperienceYears,
                SelfDeclaredWeight = dto.SelfDeclaredWeight,
                BloodType = dto.BloodType,
                HealthStatus = dto.HealthStatus
            };
            // Admin tạo tài khoản trực tiếp (đã được Admin xác thực thủ công) —
            // không bắt buộc upload file chứng chỉ như luồng tự đăng ký (ACC.1A).
            // Text gốc do Admin nhập (nếu có) vẫn được lưu tạm vào cột *Profiles.*
            // để tương thích ngược; nếu cần minh chứng file, Admin có thể yêu cầu
            // user bổ sung sau qua chức năng cập nhật hồ sơ.
            await CreateRoleProfileAsync(
                user.UserId, dto.Role, registerDto, now,
                fallbackCertificateName: dto.LicenseCertificate ?? dto.CertificationLevel ?? dto.MedicalLicenseNumber);

            await transaction.CommitAsync();

            await _auditLog.LogAsync(
                actorId: adminId,
                action: "Admin_Create_User",
                entityName: "Users",
                entityId: user.UserId.ToString(),
                newValue: $"Role={dto.Role}, Status={initialStatus}, Email={normalizedEmail}",
                ipAddress: ipAddress,
                userAgent: userAgent);

            // Welcome email — KHÔNG echo mật khẩu (bảo mật); chỉ báo tài khoản đã
            // được Admin tạo, dùng đúng email/username đã cung cấp để đăng nhập.
            // Gửi SAU khi transaction đã commit, không để lỗi email ảnh hưởng flow tạo user.
            var welcomeMessage = initialStatus == "Active"
                ? $"Tài khoản {dto.Role} của bạn đã được Admin tạo và kích hoạt sẵn. " +
                  $"Đăng nhập bằng email {normalizedEmail} và mật khẩu đã được cung cấp cho bạn."
                : $"Tài khoản {dto.Role} của bạn đã được Admin tạo, đang chờ duyệt hồ sơ chuyên môn " +
                  $"trước khi kích hoạt. Đăng nhập bằng email {normalizedEmail} khi tài khoản được duyệt.";

            await _notificationService.SendAsync(
                user.UserId,
                "Tài khoản HRTMS của bạn đã được Admin tạo",
                welcomeMessage,
                type: "Both",
                relatedEntityType: "Users",
                relatedEntityId: user.UserId);

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
    public async Task<ApiResponse<bool>> LogoutAsync(int userId, string? ipAddress, string? userAgent = null)
    {
        await _tokenBlacklistService.BlacklistUserAsync(userId);

        await _auditLog.LogAsync(
            actorId: userId,
            action: "Logout",
            entityName: "Users",
            entityId: userId.ToString(),
            ipAddress: ipAddress,
            userAgent: userAgent);

        return ApiResponse<bool>.Ok(true, "Đăng xuất thành công.");
    }

    // =========================================================
    // PWD.1 — Quên mật khẩu
    // =========================================================
    public async Task<ApiResponse<bool>> ForgotPasswordAsync(ForgotPasswordDto dto)
    {
        var email = dto.Email.Trim().ToLower();
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user is null || user.Status == "Suspended")
            return ApiResponse<bool>.Ok(true, "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.");

        var resetToken = GenerateResetToken(user);

        var baseUrl = _config["App:FrontendUrl"]?.TrimEnd('/') ?? "http://localhost:5173";
        var resetLink = $"{baseUrl}/reset-password?token={resetToken}";

        var html = BuildResetEmailHtml(user.FullName, resetLink);

        await _emailService.SendAsync(
            user.Email,
            user.FullName,
            "HRTMS — Đặt lại mật khẩu",
            html);

        return ApiResponse<bool>.Ok(true, "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.");
    }

    // =========================================================
    // PWD.2 — Reset mật khẩu
    // =========================================================
    public async Task<ApiResponse<bool>> ResetPasswordAsync(ResetPasswordDto dto)
    {
        var principal = ValidateResetToken(dto.Token);
        if (principal is null)
            return ApiResponse<bool>.Fail("Token không hợp lệ hoặc đã hết hạn.");

        var purpose = principal.FindFirst("purpose")?.Value;
        if (purpose != "password-reset")
            return ApiResponse<bool>.Fail("Token không hợp lệ hoặc đã hết hạn.");

        var userIdStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdStr, out var userId))
            return ApiResponse<bool>.Fail("Token không hợp lệ hoặc đã hết hạn.");

        var user = await _context.Users.FindAsync(userId);
        if (user is null || user.Status == "Suspended")
            return ApiResponse<bool>.Fail("Tài khoản không tồn tại hoặc đã bị khoá.");

        if (string.IsNullOrWhiteSpace(dto.NewPassword) || dto.NewPassword.Length < 6)
            return ApiResponse<bool>.Fail("Mật khẩu mới phải có ít nhất 6 ký tự.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword, workFactor: 12);
        var resetAt = DateTime.UtcNow;
        user.UpdatedAt = resetAt;
        await _context.SaveChangesAsync();

        await _tokenBlacklistService.BlacklistUserAsync(userId);

        await _auditLog.LogAsync(
            actorId: userId,
            action: "Reset_Password",
            entityName: "Users",
            entityId: userId.ToString());

        // Cảnh báo bảo mật: xác nhận mật khẩu đã được đặt lại qua luồng quên mật khẩu.
        await _emailService.SendAsync(
            user.Email, user.FullName,
            "Mật khẩu tài khoản HRTMS đã được đặt lại",
            $"<p>Mật khẩu tài khoản <b>{System.Net.WebUtility.HtmlEncode(user.FullName)}</b> " +
            $"vừa được đặt lại thành công lúc {resetAt:HH:mm dd/MM/yyyy} (UTC) qua chức năng quên mật khẩu.</p>" +
            "<p>Nếu đây không phải do bạn thực hiện, vui lòng liên hệ Admin ngay lập tức — " +
            "toàn bộ phiên đăng nhập cũ đã bị vô hiệu hoá.</p>");

        return ApiResponse<bool>.Ok(true, "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
    }

    // =========================================================
    // PRIVATE HELPERS
    // =========================================================

    private static string? ValidateProfessionalIdentity(
        string? phone, DateTime? dob, string? cccd, string role)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return $"Role {role} bắt buộc phải cung cấp số điện thoại.";

        if (dob == null)
            return $"Role {role} bắt buộc phải cung cấp ngày sinh.";

        if (string.IsNullOrWhiteSpace(cccd))
            return $"Role {role} bắt buộc phải cung cấp số CCCD.";

        if (!CccdRegex.IsMatch(cccd.Trim()))
            return "Số CCCD không hợp lệ. CCCD phải gồm đúng 12 chữ số.";

        return null;
    }

    /// <summary>
    /// Kiểm tra email "có thật" ở mức domain: domain phải tồn tại và
    /// resolve được (có MX hoặc ít nhất A/AAAA record) — nếu không thì
    /// gần như chắc chắn email không thể nhận thư (domain gõ sai, domain
    /// không tồn tại, v.v.). Đây không phải là gửi email xác thực (OTP/link),
    /// chỉ là bước lọc sớm để tránh rác domain rõ ràng không hợp lệ.
    /// Lỗi mạng/DNS tạm thời sẽ được coi là hợp lệ (fail-open) để không
    /// chặn nhầm người dùng hợp lệ khi resolver DNS gặp sự cố.
    /// </summary>
    private static async Task<bool> IsEmailDomainValidAsync(string email)
    {
        var atIndex = email.LastIndexOf('@');
        if (atIndex < 0 || atIndex == email.Length - 1)
            return false;

        var domain = email[(atIndex + 1)..].Trim();
        if (string.IsNullOrWhiteSpace(domain) || !domain.Contains('.'))
            return false;

        try
        {
            var mxRecords = await ResolveMxAsync(domain);
            if (mxRecords.Count > 0)
                return true;

            var addresses = await System.Net.Dns.GetHostAddressesAsync(domain);
            return addresses.Length > 0;
        }
        catch (System.Net.Sockets.SocketException)
        {
            return false;
        }
        catch
        {
            return true;
        }
    }

    /// <summary>
    /// Truy vấn MX record thủ công qua UDP tới DNS resolver công cộng —
    /// .NET BCL không có API MX lookup sẵn (Dns.GetHostEntry chỉ resolve
    /// A/AAAA). Trả về danh sách rỗng nếu không có MX record hoặc query lỗi.
    /// </summary>
    private static async Task<List<string>> ResolveMxAsync(string domain)
    {
        var result = new List<string>();
        try
        {
            using var client = new System.Net.Sockets.UdpClient();
            var query = BuildMxQuery(domain);
            var endpoint = new System.Net.IPEndPoint(System.Net.IPAddress.Parse("8.8.8.8"), 53);
            await client.SendAsync(query, query.Length, endpoint);

            var receiveTask = client.ReceiveAsync();
            var completed = await Task.WhenAny(receiveTask, Task.Delay(2000));
            if (completed != receiveTask)
                return result;

            result = ParseMxResponse(receiveTask.Result.Buffer);
        }
        catch
        {
            // UDP/53 bị chặn hoặc môi trường sandbox — caller sẽ fallback A/AAAA.
        }
        return result;
    }

    private static byte[] BuildMxQuery(string domain)
    {
        var labels = domain.Split('.');
        using var ms = new MemoryStream();
        ms.Write([0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        foreach (var label in labels)
        {
            var bytes = Encoding.ASCII.GetBytes(label);
            ms.WriteByte((byte)bytes.Length);
            ms.Write(bytes);
        }
        ms.WriteByte(0x00);
        ms.Write([0x00, 0x0F]); // QTYPE = MX
        ms.Write([0x00, 0x01]); // QCLASS = IN
        return ms.ToArray();
    }

    private static List<string> ParseMxResponse(byte[] data)
    {
        var mx = new List<string>();
        if (data.Length < 12) return mx;

        int ancount = (data[6] << 8) | data[7];
        int qdcount = (data[4] << 8) | data[5];
        int pos = 12;

        for (int i = 0; i < qdcount; i++)
        {
            pos = SkipName(data, pos);
            pos += 4;
        }

        for (int i = 0; i < ancount && pos < data.Length; i++)
        {
            pos = SkipName(data, pos);
            if (pos + 10 > data.Length) break;
            int type = (data[pos] << 8) | data[pos + 1];
            int rdlength = (data[pos + 8] << 8) | data[pos + 9];
            pos += 10;
            if (type == 15)
                mx.Add("mx");
            pos += rdlength;
        }
        return mx;
    }

    private static int SkipName(byte[] data, int pos)
    {
        while (pos < data.Length)
        {
            int len = data[pos];
            if (len == 0) { pos++; break; }
            if ((len & 0xC0) == 0xC0) { pos += 2; break; }
            pos += len + 1;
        }
        return pos;
    }

    private (byte[] encrypted, byte[] hash) EncryptIdentity(string cccd)
    {
        var plain = Encoding.UTF8.GetBytes(cccd.Trim());

        using var aes = Aes.Create();
        aes.Key = _encryptionKey;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var cipherText = encryptor.TransformFinalBlock(plain, 0, plain.Length);

        var result = new byte[aes.IV.Length + cipherText.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(cipherText, 0, result, aes.IV.Length, cipherText.Length);

        var hash = SHA256.HashData(plain);

        return (result, hash);
    }
    private async Task CreateRoleProfileAsync(
        int userId, string role, RegisterDto dto, DateTime now,
        Microsoft.AspNetCore.Http.IFormFile? certificateFile = null,
        string? fallbackCertificateName = null)
    {
        // Tên hiển thị lưu tạm vào cột text của *Profiles (tương thích ngược):
        // ưu tiên tên file gốc do người dùng upload, nếu không có (vd Admin tạo
        // tài khoản không kèm file) thì dùng fallback do Admin nhập tay.
        // Cột đích là varchar(50) không hỗ trợ Unicode → phải strip ký tự có dấu.
        string CertificateDisplayName(string defaultValue)
        {
            var name = certificateFile?.FileName ?? fallbackCertificateName;
            if (string.IsNullOrWhiteSpace(name)) return defaultValue;

            var asciiOnly = new string(name.Where(c => c < 128).ToArray()).Trim();
            if (string.IsNullOrWhiteSpace(asciiOnly)) asciiOnly = $"certificate_{userId}";

            return asciiOnly.Length > 50 ? asciiOnly[..50] : asciiOnly;
        }

        switch (role)
        {
            case "Spectator":
                var wallet = new Wallet
                {
                    SpectatorId = userId,
                    Balance = 1000, // EC-47
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
                    LicenseCertificate = CertificateDisplayName("Chưa cung cấp"),
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
                    CertificationLevel = CertificateDisplayName("Chưa cung cấp"),
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
                    MedicalLicenseNumber = CertificateDisplayName("Chưa cung cấp"),
                    Status = "Pending",
                    CreatedAt = now,
                    UpdatedAt = now
                });
                await _context.SaveChangesAsync();
                break;

            case "Admin":
                break;
        }

        // Lưu file chứng chỉ thật (nếu có) vào bảng Certificates — áp dụng cho
        // Jockey/Referee/Doctor. Lưu file ra đĩa TRƯỚC, insert DB SAU; nếu insert
        // lỗi thì transaction ngoài sẽ rollback DB (file mồ côi sẽ được dọn định kỳ).
        if (certificateFile != null && certificateFile.Length > 0
            && role is "Jockey" or "Referee" or "Doctor")
        {
            var saved = await _fileStorageService.SaveCertificateAsync(certificateFile, userId, role);

            _context.Certificates.Add(new Certificate
            {
                UserId = userId,
                CertificateType = role,
                FileName = saved.FileName,
                FilePath = saved.FilePath,
                ContentType = saved.ContentType,
                FileSizeBytes = saved.FileSizeBytes,
                UploadedAt = now
            });
            await _context.SaveChangesAsync();
        }
    }

    private string GenerateResetToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["JwtSettings:SecretKey"]!));

        var now = DateTime.UtcNow;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim("purpose", "password-reset"),
            new Claim(JwtRegisteredClaimNames.Iat,
                new DateTimeOffset(now).ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer: _config["JwtSettings:Issuer"],
            audience: _config["JwtSettings:Audience"],
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(15),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private ClaimsPrincipal? ValidateResetToken(string token)
    {
        try
        {
            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(_config["JwtSettings:SecretKey"]!));

            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _config["JwtSettings:Issuer"],
                ValidateAudience = true,
                ValidAudience = _config["JwtSettings:Audience"],
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out _);

            return principal;
        }
        catch
        {
            return null;
        }
    }

    private static string BuildResetEmailHtml(string fullName, string resetLink)
    {
        var safeName = System.Net.WebUtility.HtmlEncode(fullName);
        return $"""
            <!DOCTYPE html>
            <html lang="vi">
            <body style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#1f2937;background:#fff">
              <div style="border-left:4px solid #b5121b;padding-left:16px;margin-bottom:20px">
                <h2 style="margin:0;color:#b5121b;font-size:18px">Đặt lại mật khẩu HRTMS</h2>
              </div>
              <p style="font-size:15px;line-height:1.7">Xin chào <strong>{safeName}</strong>,</p>
              <p style="font-size:15px;line-height:1.7">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
                Nhấn vào nút bên dưới để tiếp tục — link chỉ có hiệu lực trong <strong>15 phút</strong>.
              </p>
              <div style="text-align:center;margin:32px 0">
                <a href="{resetLink}"
                   style="display:inline-block;padding:14px 32px;background:#b5121b;color:#fff;
                          text-decoration:none;border-radius:6px;font-weight:600;font-size:15px">
                  Đặt lại mật khẩu
                </a>
              </div>
              <p style="font-size:13px;color:#6b7280;line-height:1.6">
                Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
                Tài khoản của bạn vẫn an toàn.
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
              <p style="font-size:12px;color:#9ca3af;margin:0">
                Email này được gửi tự động từ hệ thống HRTMS. Vui lòng không trả lời email này.
              </p>
            </body>
            </html>
            """;
    }
}