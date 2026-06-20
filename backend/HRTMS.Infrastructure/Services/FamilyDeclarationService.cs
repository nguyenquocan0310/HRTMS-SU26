
using HRTMS.Core.DTOs.FamilyDeclaration;
using HRTMS.Core.Entities;
using HRTMS.Core.Interfaces.Services;
using HRTMS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HRTMS.Infrastructure.Services;

public class FamilyDeclarationService : IFamilyDeclarationService
{
    private readonly HRTMSDbContext _context;
    private readonly IFamilyDeclarationValidator _validator;

    private static readonly string[] IndustryRoles = ["Owner", "Jockey", "Referee", "Doctor"];

    public FamilyDeclarationService(HRTMSDbContext context, IFamilyDeclarationValidator validator)
    {
        _context = context;
        _validator = validator;
    }

    // =========================================================
    // GET — Lấy danh sách khai báo của chính mình
    // =========================================================
    public async Task<List<FamilyDeclarationResponseDto>> GetMyDeclarationsAsync(int declarantUserId)
    {
        var declarations = await _context.FamilyRelationshipDeclarations
            .Include(f => f.RelatedUser) // nullable navigation
            .Where(f => f.DeclarantUserId == declarantUserId)
            .OrderBy(f => f.DeclaredAt)
            .ToListAsync();

        return declarations.Select(MapToResponseDto).ToList();
    }

    // =========================================================
    // POST — Thêm 1 khai báo mới
    // =========================================================
    public async Task<FamilyDeclarationResponseDto> AddDeclarationAsync(
        int declarantUserId, FamilyDeclarationItemDto dto)
    {
        var error = await _validator.ValidateAsync([dto], declarantUserId, isRegister: false);
        if (error != null)
            throw new ArgumentException(error);

        var entity = new FamilyRelationshipDeclaration
        {
            DeclarantUserId = declarantUserId,
            RelatedPersonName = dto.RelatedPersonName.Trim(),
            RelatedUserId = dto.RelatedUserId,
            RelationType = dto.RelationType,
            IndustryRole = dto.IndustryRole,
            Notes = dto.Notes,
            DeclaredAt = DateTime.UtcNow
        };

        _context.FamilyRelationshipDeclarations.Add(entity);
        await _context.SaveChangesAsync();

        // EC-25/BR-25: khai báo thay đổi → cần re-run COI cho phân công đang hiệu lực.
        // Module F chưa viết → stub ở đây, bổ sung sau khi có ICOICheckService.
        // await _coiCheckService.ReRunForUserAsync(declarantUserId);

        // Load lại để có navigation RelatedUser
        await _context.Entry(entity).Reference(e => e.RelatedUser).LoadAsync();

        return MapToResponseDto(entity);
    }

    // =========================================================
    // PUT — Sửa 1 khai báo
    // =========================================================
    public async Task<FamilyDeclarationResponseDto> UpdateDeclarationAsync(
        int declarantUserId, int declarationId, FamilyDeclarationItemDto dto)
    {
        var entity = await _context.FamilyRelationshipDeclarations
            .FirstOrDefaultAsync(f => f.DeclarationId == declarationId
                                      && f.DeclarantUserId == declarantUserId)
            ?? throw new KeyNotFoundException($"Không tìm thấy khai báo #{declarationId}.");

        var error = await _validator.ValidateForUpdateAsync(dto, declarantUserId, declarationId);
        if (error != null)
            throw new ArgumentException(error);

        entity.RelatedPersonName = dto.RelatedPersonName.Trim();
        entity.RelatedUserId = dto.RelatedUserId;
        entity.RelationType = dto.RelationType;
        entity.IndustryRole = dto.IndustryRole;
        entity.Notes = dto.Notes;
        entity.DeclaredAt = DateTime.UtcNow; 

        await _context.SaveChangesAsync();

        // EC-25: re-run COI sau khi khai báo thay đổi (stub)
        // await _coiCheckService.ReRunForUserAsync(declarantUserId);

        await _context.Entry(entity).Reference(e => e.RelatedUser).LoadAsync();
        return MapToResponseDto(entity);
    }

    // =========================================================
    // DELETE — Xóa 1 khai báo
    // =========================================================
    public async Task DeleteDeclarationAsync(int declarantUserId, int declarationId)
    {
        var entity = await _context.FamilyRelationshipDeclarations
            .FirstOrDefaultAsync(f => f.DeclarationId == declarationId
                                      && f.DeclarantUserId == declarantUserId)
            ?? throw new KeyNotFoundException($"Không tìm thấy khai báo #{declarationId}.");

        _context.FamilyRelationshipDeclarations.Remove(entity);
        await _context.SaveChangesAsync();

        // EC-25: re-run COI sau khi khai báo bị xóa (stub)
        // await _coiCheckService.ReRunForUserAsync(declarantUserId);
    }

    // =========================================================
    // AUTOCOMPLETE — Tìm user trong ngành để gợi ý ô nhập tên người thân
    // UI-S02/S25/S27/S30: debounce gõ → gọi API này → hiển thị gợi ý
    // =========================================================
    public async Task<List<IndustryUserSearchResultDto>> SearchIndustryUsersAsync(
        string query, int excludeUserId)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
            return []; // tối thiểu 2 ký tự mới search (tránh query quá rộng)

        var q = query.Trim();

        return await _context.Users
            .Where(u => IndustryRoles.Contains(u.Role)
                        && u.UserId != excludeUserId       // không gợi ý chính mình
                        && u.Status != "Suspended"         // không gợi ý user bị suspend
                        && (u.FullName.Contains(q) || u.Username.Contains(q)))
            .OrderBy(u => u.FullName)
            .Take(10) // giới hạn 10 kết quả cho dropdown
            .Select(u => new IndustryUserSearchResultDto
            {
                UserId = u.UserId,
                FullName = u.FullName,
                Role = u.Role
            })
            .ToListAsync();
    }

    // =========================================================
    // PRIVATE HELPER — map entity sang DTO
    // =========================================================
    private static FamilyDeclarationResponseDto MapToResponseDto(FamilyRelationshipDeclaration entity) =>
        new()
        {
            DeclarationId = entity.DeclarationId,
            DeclarantUserId = entity.DeclarantUserId,
            RelatedPersonName = entity.RelatedPersonName,
            RelatedUserId = entity.RelatedUserId,
            RelatedUserFullName = entity.RelatedUser?.FullName,
            RelatedUserRole = entity.RelatedUser?.Role,
            RelationType = entity.RelationType,
            IndustryRole = entity.IndustryRole,
            Notes = entity.Notes,
            DeclaredAt = entity.DeclaredAt
        };
}