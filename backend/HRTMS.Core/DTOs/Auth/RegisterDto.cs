using Microsoft.AspNetCore.Http;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace HRTMS.Core.DTOs.Auth;

/// <summary>
/// ACC.1 — Đăng ký tài khoản mới (tự đăng ký, không bao gồm Admin).
/// ACC.1A — Owner/Jockey/Referee/Doctor bắt buộc có PhoneNumber + DateOfBirth + IdentityNumber (CCCD 12 số).
/// ACC.1.2 — Spectator đăng ký tối giản: chỉ cần Username/FullName/Email/Password.
/// </summary>
public class RegisterDto
{
    [Required, MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = string.Empty;

    // ── Định danh bắt buộc cho Owner/Jockey/Referee/Doctor (ACC.1A.1) ──────
    public string? PhoneNumber { get; set; }

    public DateTime? DateOfBirth { get; set; }

    /// <summary>
    /// CCCD 12 số. Bắt buộc với professional roles.
    /// Validate app-layer: regex ^\d{12}$ (DB lưu dạng encrypted VARBINARY).
    /// </summary>
    public string? IdentityNumber { get; set; }

    // ── Jockey profile ──────────────────────────────────────────────────────
    public int? ExperienceYears { get; set; }
    public decimal? SelfDeclaredWeight { get; set; }
    public string? BloodType { get; set; }
    public string? HealthStatus { get; set; }

    // ── Referee profile ─────────────────────────────────────────────────────
    // (CertificationLevel dạng text đã bị thay bằng file upload — xem CertificateFile)

    // ── Doctor profile ──────────────────────────────────────────────────────
    // (MedicalLicenseNumber dạng text đã bị thay bằng file upload — xem CertificateFile)

    /// <summary>
    /// File chứng chỉ/bằng cấp — BẮT BUỘC với role Jockey/Referee/Doctor.
    /// Thay thế cho việc gõ tay tên/số chứng chỉ như trước đây (ACC.1A).
    /// Chấp nhận: .pdf, .jpg, .jpeg, .png, .webp — tối đa 10MB.
    /// Gửi kèm dưới dạng multipart/form-data.
    /// </summary>
    public IFormFile? CertificateFile { get; set; }
}