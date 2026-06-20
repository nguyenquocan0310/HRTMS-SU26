// FILE: backend/HRTMS.Infrastructure/Services/FamilyDeclarationValidator.cs
using HRTMS.Core.DTOs.FamilyDeclaration;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class FamilyDeclarationValidator : IFamilyDeclarationValidator
{
	private readonly HRTMSDbContext _context;

	// Role hợp lệ của người thân được khai báo (Owner là phía bị match, không tự khai)
	private static readonly string[] IndustryRoles = ["Owner", "Jockey", "Referee", "Doctor"];

	private static readonly string[] ValidRelationTypes = ["Spouse", "Parent", "Child", "Sibling"];

	public FamilyDeclarationValidator(HRTMSDbContext context)
	{
		_context = context;
	}

	// =========================================================
	// Validate batch — dùng khi Register (nhiều dòng cùng lúc) hoặc Add đơn lẻ
	// =========================================================
	public async Task<string?> ValidateAsync(
		List<FamilyDeclarationItemDto> declarations, int declarantUserId, bool isRegister = false)
	{
		foreach (var item in declarations)
		{
			var itemError = ValidateSingleItemShape(item);
			if (itemError != null)
				return itemError;

			// RelatedUserId hợp lệ → user đó phải tồn tại và có Role trong ngành
			if (item.RelatedUserId.HasValue)
			{
				var relatedUser = await _context.Users
					.FirstOrDefaultAsync(u => u.UserId == item.RelatedUserId.Value);

				if (relatedUser == null)
					return $"Không tìm thấy người dùng có UserId={item.RelatedUserId}.";

				if (!IndustryRoles.Contains(relatedUser.Role))
					return $"Người thân (UserId={item.RelatedUserId}) phải là thành viên trong ngành " +
						   $"({string.Join(", ", IndustryRoles)}).";
			}
		}

		// Không trùng RelatedUserId trong cùng batch
		var userIdDups = declarations
			.Where(d => d.RelatedUserId.HasValue)
			.GroupBy(d => d.RelatedUserId)
			.Where(g => g.Count() > 1)
			.Select(g => g.Key)
			.ToList();
		if (userIdDups.Count > 0)
			return $"Khai báo trùng người thân (RelatedUserId: {string.Join(", ", userIdDups)}).";

		// Không trùng RelatedPersonName trong cùng batch khi cả hai NULL RelatedUserId
		var nameDups = declarations
			.Where(d => !d.RelatedUserId.HasValue)
			.GroupBy(d => d.RelatedPersonName.Trim().ToLower())
			.Where(g => g.Count() > 1)
			.Select(g => g.Key)
			.ToList();
		if (nameDups.Count > 0)
			return $"Khai báo trùng tên người thân: {string.Join(", ", nameDups)}.";

		// Với CRUD sau đăng ký (isRegister=false): check trùng với dữ liệu đã có trong DB
		if (!isRegister && declarantUserId > 0)
		{
			foreach (var item in declarations.Where(d => d.RelatedUserId.HasValue))
			{
				var exists = await _context.FamilyRelationshipDeclarations
					.AnyAsync(f => f.DeclarantUserId == declarantUserId
								   && f.RelatedUserId == item.RelatedUserId);
				if (exists)
					return $"Đã có khai báo với người thân (RelatedUserId={item.RelatedUserId}).";
			}
		}

		return null; // hợp lệ
	}

	// =========================================================
	// Validate đơn lẻ cho Update — loại trừ chính dòng đang sửa khỏi check trùng
	// =========================================================
	public async Task<string?> ValidateForUpdateAsync(
		FamilyDeclarationItemDto dto, int declarantUserId, int excludeDeclarationId)
	{
		var shapeError = ValidateSingleItemShape(dto);
		if (shapeError != null)
			return shapeError;

		if (dto.RelatedUserId.HasValue)
		{
			var relatedUser = await _context.Users
				.FirstOrDefaultAsync(u => u.UserId == dto.RelatedUserId.Value);
			if (relatedUser == null)
				return $"Không tìm thấy người dùng có UserId={dto.RelatedUserId}.";
			if (!IndustryRoles.Contains(relatedUser.Role))
				return $"Người thân (UserId={dto.RelatedUserId}) phải là thành viên trong ngành.";

			var duplicate = await _context.FamilyRelationshipDeclarations
				.AnyAsync(f => f.DeclarantUserId == declarantUserId
							   && f.RelatedUserId == dto.RelatedUserId
							   && f.DeclarationId != excludeDeclarationId);
			if (duplicate)
				return $"Đã có khai báo với người thân (RelatedUserId={dto.RelatedUserId}).";
		}
		else
		{
			var nameTrimmed = dto.RelatedPersonName.Trim().ToLower();
			var duplicate = await _context.FamilyRelationshipDeclarations
				.AnyAsync(f => f.DeclarantUserId == declarantUserId
							   && f.RelatedUserId == null
							   && f.RelatedPersonName.ToLower() == nameTrimmed
							   && f.DeclarationId != excludeDeclarationId);
			if (duplicate)
				return $"Đã có khai báo với người thân tên '{dto.RelatedPersonName.Trim()}'.";
		}

		return null;
	}

	// =========================================================
	// PRIVATE — validate hình thức cơ bản (RelationType, tên không rỗng)
	// Dùng chung cho cả ValidateAsync và ValidateForUpdateAsync, tránh lặp code.
	// Sửa bug bản cũ: bản gốc dùng Enum.TryParse<string> — vô nghĩa vì string
	// không phải kiểu enum, lệnh đó luôn trả về false nên không có tác dụng gì.
	// =========================================================
	private static string? ValidateSingleItemShape(FamilyDeclarationItemDto item)
	{
		if (!ValidRelationTypes.Contains(item.RelationType))
			return $"RelationType '{item.RelationType}' không hợp lệ. " +
				   $"Các giá trị được phép: {string.Join(", ", ValidRelationTypes)}.";

		if (string.IsNullOrWhiteSpace(item.RelatedPersonName))
			return "RelatedPersonName không được để trống.";

		return null;
	}
}