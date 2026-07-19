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

export interface RaceEntriesData {
  raceId: number;
  roundId: number;
  raceNumber: number;
  scheduledTime: string;
  status: string;
  isPostPositionDrawn: boolean;
  entries: RawRaceEntryApiItem[];
}

export const getRaceSchedule = (
  raceId: number
): Promise<RaceEntriesData> =>
  apiFetch<ApiResponse<RaceEntriesData>>(
    `/races/${raceId}/entries`
  ).then((res) => {
    if (!res.success || !res.data) {
      throw new Error(res.message || 'Không tải được danh sách xuất phát.');
    }
    return res.data;
  });

export const getRaceEntries = (
  raceId: number
): Promise<RaceScheduleEntry[]> =>
  getRaceSchedule(raceId)
    .then((data) =>
    (data.entries ?? []).map((entry) => ({
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
    if (!res.success || !res.data) {
      throw new Error(
        res.message || 'Allocate không trả về dữ liệu.'
      );
    }

    return res.data;
  });

export interface PostPositionAssignment {
  raceEntryId: number;
  pairingId: number;
  horseId: number;
  horseName: string;
  postPosition: number;
}

export interface PostPositionDrawResult {
  raceId: number;
  isPostPositionDrawn: boolean;
  totalEntries: number;
  assignments: PostPositionAssignment[];
}

export const drawPostPositions = (
  raceId: number
): Promise<PostPositionDrawResult> =>
  apiFetch<PostPositionDrawResult>(`/admin/races/${raceId}/draw`, {
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
  advancementStatus: string | null;
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

export const getAdminPairings = (
  tournamentId: number,
  targetRaceId: number,
  unallocatedOnly = true,
  pageSize = 100
): Promise<AdminPairing[]> => {
  const params = new URLSearchParams({
    tournamentId: String(tournamentId),
    targetRaceId: String(targetRaceId),
    status: 'Confirmed',
    unallocatedOnly: String(unallocatedOnly),
    page: '1',
    pageSize: String(pageSize),
  });

  return apiFetch<PagedResult<AdminPairing>>(
    `/admin/pairings?${params.toString()}`
  ).then((res) => res.items ?? []);
};

export interface DeclareOfficialPayload {
  confirmedByAdmin: boolean;
}

export interface DeclareOfficialResult {
  raceId: number;
  raceStatus: string;
  officialAt: string;
  predictionsSettledCount: number;
  predictionsRefundedCount: number;
  pursePayoutsCreatedCount: number;
  remainderAmount: number;
}

export const declareRaceOfficial = (
  raceId: number,
  payload: DeclareOfficialPayload
): Promise<DeclareOfficialResult> =>
  apiFetch<ApiResponse<DeclareOfficialResult>>(
    `/races/${raceId}/declare-official`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  ).then((res) => {
    if (!res.success || !res.data) {
      throw new Error(
        res.message ||
          'Không thể chuyển Race thành Official.'
      );
    }

    return res.data;
  });

export interface RacePayout {
  pursePayoutId: number;
  raceEntryId: number;
  recipientUserId: number;
  recipientName: string;
  role: string;
  finishPosition: number;
  horseName: string;
  calculatedAmount: number;
  payoutStatus: string;
  paidAt: string | null;
  updatedByAdminId: number | null;
  updatedAt: string;
}

interface RacePayoutData {
  raceId: number;
  raceNumber: number;
  roundName: string;
  tournamentName: string;
  raceStatus: string;
  purseAmount: number;
  totalAllocated: number;
  remainderAmount: number;
  payouts: RacePayout[];
}

/**
 * GET /api/races/{raceId}/payouts
 */
export const getRacePayouts = async (
  raceId: number
): Promise<RacePayout[]> => {
  const res = await apiFetch<ApiResponse<RacePayoutData>>(
    `/races/${raceId}/payouts`
  );

  if (!res.success || !res.data) {
    throw new Error(
      res.message || 'Không tải được dữ liệu chi thưởng.'
    );
  }

  return res.data.payouts ?? [];
};


// ─── Race List (Unofficial) — dùng cho trang riêng, KHÔNG dùng ở Race Operations ─
export interface UnofficialRace {
  raceId: number;
  tournamentId: number;
  tournamentName: string;
  roundName: string;
  raceNumber: number;
  scheduledTime: string;
  hasRaceReport: boolean;
  isRaceReportLocked: boolean;
  hasPendingProtests: boolean;
  prizeDistributionsConfigured: boolean;
  rankingIntegrityValid: boolean;
  postRaceWeighInComplete: boolean;
  protestWindowClosed: boolean;
  protestDeadlineAt: string | null;
  canDeclareOfficial: boolean;
}

export const getUnofficialRaces = (
  tournamentId?: number
): Promise<UnofficialRace[]> =>
  apiFetch<ApiResponse<UnofficialRace[]>>(
    tournamentId ? `/races/unofficial?tournamentId=${tournamentId}` : '/races/unofficial'
  ).then((res) => res.data ?? []);

// ─── Live Race Status — nguồn "Kết quả sơ bộ" trước khi Official ───────────
export interface LiveRaceEntry {
  raceEntryId: number;
  postPosition: number | null;
  status: string;
  isWithdrawn: boolean;
  horseId: number;
  horseName: string;
  jockeyId: number;
  jockeyName: string;
  finishPosition: number | null;
  finishTime: number | null;
}

export interface LiveRaceStatus {
  raceId: number;
  status: string;
  scheduledTime: string;
  actualStartTime: string | null;
  raceDurationSeconds: number;
  entries: LiveRaceEntry[];
}

export const getLiveRaceStatus = (raceId: number): Promise<LiveRaceStatus> =>
  apiFetch<ApiResponse<LiveRaceStatus>>(`/races/${raceId}/live-status`).then((res) => {
    if (!res.data) throw new Error(res.message || 'Không tải được kết quả sơ bộ.');
    return res.data;
  });