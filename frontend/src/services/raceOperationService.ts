import { apiFetch } from './apiClient';

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
  entryFeeStatus: string;
  horseId: number;
  horseName: string;
  horseBreed?: string;
  jockeyId: number;
  jockeyName: string;
  ownerName?: string;
}

interface RawRaceEntryApiItem {
  raceEntryId: number;
  postPosition: number | null;
  status: string;
  entryFeeStatus: string;
  horseId: number;
  horseName: string;
  horseBreed?: string;
  jockeyId: number;
  jockeyName: string;
  ownerName?: string;
}

interface RaceEntriesData {
  raceId: number;
  roundId: number;
  raceNumber: number;
  scheduledTime: string;
  status: string;
  isPostPositionDrawn: boolean;
  entries: RawRaceEntryApiItem[];
}

/**
 * GET /api/races/{raceId}/entries
 *
 * API thực tế trả:
 * {
 *   success: true,
 *   data: {
 *     raceId,
 *     roundId,
 *     raceNumber,
 *     scheduledTime,
 *     status,
 *     isPostPositionDrawn,
 *     entries: [...]
 *   }
 * }
 *
 * apiFetch đã unwrap lớp ngoài, nên res chính là object nằm trong data.
 */
export const getRaceEntries = (
  raceId: number
): Promise<RaceScheduleEntry[]> =>
  apiFetch<RaceEntriesData>(`/races/${raceId}/entries`).then((res) =>
    (res.entries ?? []).map((entry) => ({
      raceEntryId: entry.raceEntryId,
      postPosition: entry.postPosition,
      status: entry.status,
      entryFeeStatus: entry.entryFeeStatus,
      horseId: entry.horseId,
      horseName: entry.horseName,
      horseBreed: entry.horseBreed,
      jockeyId: entry.jockeyId,
      jockeyName: entry.jockeyName,
      ownerName: entry.ownerName,
    }))
  );

/**
 * POST /api/admin/races/{raceId}/entries
 * Allocate một pairing đã Confirmed vào Race.
 */
export const allocateEntry = (
  raceId: number,
  pairingId: number
): Promise<RaceEntryResponse> =>
  apiFetch<RaceEntryResponse>(`/admin/races/${raceId}/entries`, {
    method: 'POST',
    body: JSON.stringify({ pairingId }),
  });

/**
 * POST /api/admin/races/{raceId}/draw
 * Bốc thăm post position cho các RaceEntry của Race.
 */
export const drawPostPositions = (
  raceId: number
): Promise<unknown> =>
  apiFetch(`/admin/races/${raceId}/draw`, {
    method: 'POST',
  });

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
  totalPages?: number;
}

/**
 * GET /api/admin/pairings
 *
 * Lấy pairing:
 * - thuộc đúng Tournament;
 * - có status Confirmed;
 * - có thể chỉ lấy pairing chưa allocate.
 */
export const getAdminPairings = (
  tournamentId: number,
  unallocatedOnly = true,
  pageSize = 100
): Promise<AdminPairing[]> => {
  const params = new URLSearchParams({
    tournamentId: String(tournamentId),
    status: 'Confirmed',
    unallocatedOnly: String(unallocatedOnly),
    page: '1',
    pageSize: String(pageSize),
  });

  return apiFetch<PagedResult<AdminPairing>>(
    `/admin/pairings?${params.toString()}`
  ).then((res) => res.items ?? []);
};