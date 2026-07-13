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


export interface AdminPairing {
  pairingId: number;
  tournamentId: number;
  tournamentName: string;
  horseId: number;
  horseName: string;
  horseBreed: string;
  jockeyId: number;
  jockeyName: string;
  ownerId: number;
  ownerName: string;
  status: string;
  isAllocated: boolean;
  createdAt: string;
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

// GET /api/admin/pairings — Module E allocation picker (thay ô nhập tay Pairing ID)
export const getAdminPairings = (
  tournamentId: number,
  unallocatedOnly = true,
  pageSize = 100
): Promise<AdminPairing[]> =>
  apiFetch<PagedResult<AdminPairing>>(
    `/admin/pairings?tournamentId=${tournamentId}&status=Confirmed&unallocatedOnly=${unallocatedOnly}&page=1&pageSize=${pageSize}`
  ).then((res) => res.items);