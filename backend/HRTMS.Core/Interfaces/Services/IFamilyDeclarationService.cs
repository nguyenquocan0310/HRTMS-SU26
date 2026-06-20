
using HRTMS.Core.DTOs.FamilyDeclaration;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services;

public interface IFamilyDeclarationService
{
    // CRUD — dùng chung Jockey (UI-S25), Referee (UI-S27), Doctor (UI-S30)
    Task<List<FamilyDeclarationResponseDto>> GetMyDeclarationsAsync(int declarantUserId);
    Task<FamilyDeclarationResponseDto> AddDeclarationAsync(int declarantUserId, FamilyDeclarationItemDto dto);
    Task<FamilyDeclarationResponseDto> UpdateDeclarationAsync(int declarantUserId, int declarationId, FamilyDeclarationItemDto dto);
    Task DeleteDeclarationAsync(int declarantUserId, int declarationId);

    // Autocomplete search user trong ngành cho ô nhập tên người thân (UI-S02/S25/S27/S30)
    Task<List<IndustryUserSearchResultDto>> SearchIndustryUsersAsync(string query, int excludeUserId);
}