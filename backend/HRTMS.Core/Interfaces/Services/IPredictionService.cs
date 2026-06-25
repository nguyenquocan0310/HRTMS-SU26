using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Prediction;

namespace HRTMS.Core.Interfaces.Services;

public interface IPredictionService
{
	Task<ApiResponse<bool>> SetPredictionGateAsync(int raceId, PredictionGateConfigDto dto, int adminId, string? ipAddress);
	Task<ApiResponse<PredictionGateStatusDto>> GetGateStatusAsync(int raceId);
	Task<ApiResponse<List<FormScoreDto>>> GetFormScoresAsync(int raceId);
	Task<ApiResponse<PredictionResponseDto>> PlacePredictionAsync(int spectatorId, PlacePredictionDto dto, string? ipAddress);
}