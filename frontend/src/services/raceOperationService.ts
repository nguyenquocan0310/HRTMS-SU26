import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface RaceEntryResponse {
  raceEntryId: number;
  raceId: number;
  pairingId: number;
  postPosition: number | null;
  status: string;
  entryFeeStatus: string;
  isWithdrawn: boolean;
  horseId: number;
  horseName: string;
  jockeyId: number;
  jockeyName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RaceScheduleEntry {
  raceEntryId: number;
  postPosition: number | null;
  status: string;
  horseId: number;
  horseName: string;
  jockeyId: number;
  jockeyName: string;
}

export interface RaceSchedule {
  raceId: number;
  roundId: number;
  raceNumber: number;
  scheduledTime: string;
  status: string;
  isPostPositionDrawn: boolean;
  entries: RaceScheduleEntry[];
}

// GET /api/races/{raceId}/entries — starting list
export const getRaceEntries = (raceId: number): Promise<RaceSchedule> =>
  apiFetch<{ success: boolean; data: RaceSchedule }>(`/races/${raceId}/entries`)
    .then((res) => res.data!);

// POST /api/admin/races/{raceId}/entries — allocate pairing
export const allocateEntry = (raceId: number, pairingId: number): Promise<RaceEntryResponse> =>
  apiFetch<ApiResponse<RaceEntryResponse>>(`/admin/races/${raceId}/entries`, {
    method: 'POST',
    body: JSON.stringify({ pairingId }),
  }).then((res) => {
    if (!res.data) throw new Error(res.message || 'Allocate thất bại.');
    return res.data;
  });

// POST /api/admin/races/{raceId}/draw — draw post positions
export const drawPostPositions = (raceId: number): Promise<unknown> =>
  apiFetch(`/admin/races/${raceId}/draw`, { method: 'POST' });