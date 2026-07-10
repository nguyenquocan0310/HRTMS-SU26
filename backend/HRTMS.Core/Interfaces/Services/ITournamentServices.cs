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
        Task<TournamentResponseDto> UpdateTournamentAsync(int tournamentId, UpdateTournamentDto dto, int adminUserId);

        // STATE MACHINE
        Task<TournamentResponseDto> ChangeStatusAsync(int tournamentId, string targetStatus, int adminUserId);

        // CANCEL
        Task CancelTournamentAsync(int tournamentId, int adminUserId);

        // PRIZE DISTRIBUTION
        Task<List<PrizeDistributionResponseDto>> SetPrizeDistributionsAsync(int tournamentId, SetPrizeDistributionDto dto, int adminUserId);

        // ROUND & RACE
        Task<RoundResponseDto> CreateRoundAsync(int tournamentId, CreateRoundDto dto, int adminUserId);
        Task<RaceResponseDto> CreateRaceAsync(int roundId, CreateRaceDto dto, int adminUserId);

        // Cập nhật Race; đóng băng trường nhạy cảm sau bốc thăm / có Prediction
        Task<RaceResponseDto> UpdateRaceAsync(int raceId, UpdateRaceDto dto, int adminUserId);
    }
}
