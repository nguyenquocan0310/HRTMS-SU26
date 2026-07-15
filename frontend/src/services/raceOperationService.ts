import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
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
 * API trả:
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
 * apiFetch không unwrap data, nên phải đọc res.data.entries.
 */
export const getRaceEntries = (
  raceId: number
): Promise<RaceScheduleEntry[]> =>
  apiFetch<ApiResponse<RaceEntriesData>>(
    `/races/${raceId}/entries`
  ).then((res) =>
    (res.data?.entries ?? []).map((entry) => ({
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
 * Allocate pairing vào Race.
 */
export const allocateEntry = (
  raceId: number,
  pairingId: number
): Promise<RaceEntryResponse> =>
  apiFetch<ApiResponse<RaceEntryResponse>>(
    `/admin/races/${raceId}/entries`,
    {
      method: 'POST',
      body: JSON.stringify({ pairingId }),
    }
  ).then((res) => {
    if (!res.data) {
      throw new Error(res.message || 'Allocate không trả về dữ liệu.');
    }

    return res.data;
  });

/**
 * POST /api/admin/races/{raceId}/draw
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
 * Theo ảnh Network trước đó, endpoint này đang trả PagedResult trực tiếp:
 * {
 *   items: [],
 *   totalCount: 0,
 *   ...
 * }
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