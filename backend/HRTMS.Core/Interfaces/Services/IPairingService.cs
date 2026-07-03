using HRTMS.Core.Common;
using HRTMS.Core.DTOs.Jockey;
using HRTMS.Core.DTOs.Pairing;

namespace HRTMS.Core.Interfaces.Services;

public interface IPairingService
{
    Task<PairingResponseDto> CreateAsync(
        int ownerId,
        CreatePairingDto dto);

    Task<PairingActionResponseDto> AcceptAsync(
        int jockeyId,
        int pairingId);

    Task<PairingActionResponseDto> DeclineAsync(
        int jockeyId,
        int pairingId,
        DeclinePairingDto dto);

    Task<PagedResult<OwnerPairingDto>> GetOwnerPairingsAsync(
        int ownerId,
        string? status,
        int? horseId,
        int page,
        int pageSize);

    Task<PagedResult<JockeyInvitationDto>> GetJockeyInvitationsAsync(
        int jockeyId,
        int page,
        int pageSize);

    Task<PairingActionResponseDto> ConfirmAsync(
        int ownerId,
        int pairingId);

    Task<PairingActionResponseDto> CancelAsync(
        int ownerId,
        int pairingId);
}