using HRTMS.Core.DTOs.Result;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services
{
    public interface IResultService
    {
        // Danh sách Race Unofficial chờ Declare (optionally filter theo giải)
        Task<List<UnofficialRaceListItemDto>> GetUnofficialRacesAsync(int? tournamentId);

        // Declare Official (ACID 6 bước)
        Task<DeclareOfficialResultDto> DeclareOfficialAsync(int raceId, DeclareOfficialDto dto, int adminUserId);
    }
}