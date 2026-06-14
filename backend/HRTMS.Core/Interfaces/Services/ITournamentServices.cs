using HRTMS.Core.DTOs.Tournament;
using HRTMS.Core.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace HRTMS.Core.Interfaces.Services
{
    public interface ITournamentServices
    {
        // TOURNAMENT CRUD
        Task<TournamentResponseDto> CreateTournamentAsync(CreateTournamentDto dto, int createByUserId);
        Task<TournamentResponseDto?> GetTournamentByIdAsync(int tournamentId);
        Task<List<TournamentResponseDto>> GetAllTournamentsAsync();
        Task<TournamentResponseDto> UpdateTournamentAsync(int tournamentId, UpdateTournamentDto dto);

        // STATE MACHINE
        Task<TournamentResponseDto> ChangeStatusAsync(int tournamentId, string targetStatus, int adminUserId);

        // CANCEL (TRN.10)
        Task CancelTournamentAsync(int tournamentId, int adminUserId);

        // PRIZE DISTRIBUTION (TRN.4)
        Task<List<PrizeDistributionResponseDto>> SetPrizeDistributionAsync(int tournamentId, SetPrizeDistributionDto dto);

        // ROUND & RACE (TRN.6)
        Task<RoundResponseDto> CreateRoundAsync(int tournamentId, CreateRoundDto dto);
        Task<RaceResponseDto> CreateRaceAsync(int roundId, CreateRaceDto dto); 
    }
}
