// ─── Cổng dịch vụ Tournament ─────────────────────────────────────────────────
// Đã nối API thật (BE: localhost:5222). Component LUÔN import từ file này.

import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

// ─── Types khớp đúng response thật từ BE ────────────────────────────────────

export interface RaceResponse {
  raceId: number;
  roundId: number;
  raceNumber: number;
  scheduledTime: string;
  purseAmount: number;
  trackTypeOverride: string | null;
  raceDistanceOverride: number | null;
  status: string;
  confirmationCutoffHours: number;
  protestDeadlineMinutes: number;
}

export interface RoundResponse {
  roundId: number;
  name: string;
  sequenceOrder: number;
  scheduledDate: string;
  status: string;
  races: RaceResponse[];
}

export interface PrizeDistributionResponse {
  position: number;
  percentage: number;
}

export interface TournamentResponse {
  tournamentId: number;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  maxHorses: number;
  allowedBreed: string;
  trackType: string;
  raceDistance: number;
  raceCategory: string;
  minJockeyExperienceYears: number;
  purseAmount: number;
  entryFeeAmount: number;
  preRaceWeightThresholdKg: number;
  postRaceWeightDiffThresholdKg: number;
  status: string;
  createdAt: string;
  rounds: RoundResponse[];
  prizeDistributions: PrizeDistributionResponse[];
}

// ─── Payload gửi lên khi tạo/sửa giải ────────────────────────────────────────

export interface CreateTournamentPayload {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  maxHorses?: number;
  allowedBreed: string;
  trackType: string;
  raceDistance?: number;
  raceCategory: string;
  minJockeyExperienceYears?: number;
  purseAmount?: number;
  entryFeeAmount?: number;
  preRaceWeightThresholdKg?: number;
  postRaceWeightDiffThresholdKg?: number;
}

// ─── API calls ───────────────────────────────────────────────────────────────

export const getTournaments = (): Promise<TournamentResponse[]> =>
  apiFetch<ApiResponse<TournamentResponse[]>>('/tournament').then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Không tải được danh sách giải đấu.');
    return res.data;
  });

export const getTournamentById = (id: number): Promise<TournamentResponse> =>
  apiFetch<ApiResponse<TournamentResponse>>(`/tournament/${id}`).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Không tải được thông tin giải đấu.');
    return res.data;
  });

export const createTournament = (payload: CreateTournamentPayload): Promise<TournamentResponse> =>
  apiFetch<ApiResponse<TournamentResponse>>('/tournament', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Tạo giải đấu thất bại.');
    return res.data;
  });

export const updateTournament = (id: number, payload: CreateTournamentPayload): Promise<TournamentResponse> =>
  apiFetch<ApiResponse<TournamentResponse>>(`/tournament/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Cập nhật giải đấu thất bại.');
    return res.data;
  });

export const deleteTournament = (id: number): Promise<void> =>
  apiFetch<ApiResponse<unknown>>(`/tournament/${id}`, { method: 'DELETE' }).then((res) => {
    if (!res.success) throw new Error(res.message || 'Xóa giải đấu thất bại.');
  });

export const updateTournamentStatus = (id: number, status: string): Promise<TournamentResponse> =>
  apiFetch<ApiResponse<TournamentResponse>>(`/tournament/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ targetStatus: status }),
  }).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Cập nhật trạng thái thất bại.');
    return res.data;
  });

export interface UpdatePrizeDistributionPayload {
  position: number;
  percentage: number;
}

export const updatePrizeDistributions = (
  id: number,
  prizeDistributions: UpdatePrizeDistributionPayload[]
): Promise<TournamentResponse> =>
  // BE nhận field "distributions" (SetPrizeDistributionDto.Distributions).
  // Gửi sai key "prizeDistributions" sẽ làm DTO rỗng → ModelState 400 (MinLength 5).
  apiFetch<ApiResponse<TournamentResponse>>(`/tournament/${id}/prize-distributions`, {
    method: 'PUT',
    body: JSON.stringify({ distributions: prizeDistributions }),
  }).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Cập nhật tỷ lệ giải thưởng thất bại.');
    return res.data;
  });

export interface CreateRoundPayload {
  name: string;
  sequenceOrder: number;
  scheduledDate: string;
}

export const createRound = (tournamentId: number, payload: CreateRoundPayload): Promise<RoundResponse> =>
  apiFetch<ApiResponse<RoundResponse>>(`/tournament/${tournamentId}/rounds`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Tạo Round thất bại.');
    return res.data;
  });

export interface CreateRacePayload {
  raceNumber: number;
  scheduledTime: string;
  purseAmount: number;
  trackTypeOverride?: string;
  raceDistanceOverride?: number;
  confirmationCutoffHours?: number;
  protestDeadlineMinutes?: number;
}

export const createRace = (roundId: number, payload: CreateRacePayload): Promise<RaceResponse> =>
  apiFetch<ApiResponse<RaceResponse>>(`/rounds/${roundId}/races`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then((res) => {
    if (!res.success || !res.data) throw new Error(res.message || 'Tạo Race thất bại.');
    return res.data;
  });