using HRTMS.Core.DTOs.Result;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services
{
    public interface IResultService
    {
        // REQ-F-RES.1 — danh sách Race Unofficial chờ Declare (optionally filter theo giải)
        Task<List<UnofficialRaceListItemDto>> GetUnofficialRacesAsync(int? tournamentId);

        // REQ-F-RES.2/RES.3/RES.4/RES.5 — Declare Official (ACID 6 bước)
        Task<DeclareOfficialResultDto> DeclareOfficialAsync(int raceId, DeclareOfficialDto dto, int adminUserId);
    }
}