import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T | null;
}

export interface PursePayoutItem {
  pursePayoutId: number;
  raceEntryId: number;
  recipientUserId: number;
  recipientName: string;
  role: 'Owner' | 'Jockey' | string;
  finishPosition: number;
  horseName: string;
  calculatedAmount: number;
  payoutStatus: 'Paid' | 'Unpaid' | string;
  paidAt: string | null;
  updatedByAdminId: number | null;
  updatedAt: string;
}

export interface RacePayoutSummary {
  raceId: number;
  raceNumber: number;
  roundName: string;
  tournamentName: string;
  raceStatus: string;
  purseAmount: number;
  totalAllocated: number;
  remainderAmount: number;
  payouts: PursePayoutItem[];
}

export interface EarningsHistoryItem {
  recipientUserId: number;
  recipientName: string;
  role: 'Owner' | 'Jockey' | string;
  totalEarnings: number;
  paidAmount: number;
  unpaidAmount: number;
  payoutCount: number;
}

export interface RacePurseSummary {
  raceId: number;
  raceNumber: number;
  raceName: string;
  roundName: string;
  tournamentName: string;
  allocatedFund: number;
  paidAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  payoutStatus: string;
  resultStatus: string;
  hasDiscrepancy: boolean;
  discrepancyAmount: number | null;
  payouts: PursePayoutItem[];
}

export interface RoundPurseSummaryItem {
  roundId: number;
  roundName: string;
  roundStatus: string;
  allocatedFund: number;
  paidAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  paidRaceCount: number;
  totalRaceCount: number;
  hasDiscrepancy: boolean;
}

export interface TournamentPurseSummary {
  tournamentId: number;
  tournamentName: string;
  tournamentStatus: string;
  totalFund: number;
  paidAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  paidRaceCount: number;
  totalRaceCount: number;
  completedRoundCount: number;
  totalRoundCount: number;
  hasDiscrepancy: boolean;
  rounds: RoundPurseSummaryItem[];
}

const unwrap = <T>(res: ApiResponse<T>, fallback: string): T => {
  if (!res.success || res.data == null) {
    throw new Error(res.message || fallback);
  }
  return res.data;
};

export const getTournamentPurseSummary = async (tournamentId: number): Promise<TournamentPurseSummary> =>
  unwrap(
    await apiFetch<ApiResponse<TournamentPurseSummary>>(`/tournament/${tournamentId}/purse-summary`),
    'Không tải được tổng hợp quỹ thưởng của giải đấu.'
  );

export const getRacePurseSummary = async (raceId: number): Promise<RacePurseSummary> =>
  unwrap(
    await apiFetch<ApiResponse<RacePurseSummary>>(`/races/${raceId}/purse-summary`),
    'Không tải được tổng hợp quỹ thưởng của cuộc đua.'
  );

/**
 * GET /api/races/{raceId}/payouts
 * Role: Admin
 */
export const getRacePayoutSummary = async (
  raceId: number
): Promise<RacePayoutSummary> => {
  const res = await apiFetch<ApiResponse<RacePayoutSummary>>(
    `/races/${raceId}/payouts`
  );

  if (!res.success || !res.data) {
    throw new Error(
      res.message || 'Không tải được dữ liệu quỹ của Race.'
    );
  }

  return res.data;
};

/**
 * PUT /api/payouts/{payoutId}/status
 * Role: Admin
 */
export const updatePayoutStatus = async (
  payoutId: number,
  payoutStatus: 'Paid' | 'Unpaid'
): Promise<PursePayoutItem> => {
  const res = await apiFetch<ApiResponse<PursePayoutItem>>(
    `/payouts/${payoutId}/status`,
    {
      method: 'PUT',
      body: JSON.stringify({ payoutStatus }),
    }
  );

  if (!res.success || !res.data) {
    throw new Error(
      res.message || 'Không cập nhật được trạng thái chi trả.'
    );
  }

  return res.data;
};

/**
 * GET /api/payouts/earnings-history
 * Role: Admin
 *
 * recipientUserId và role đều tùy chọn.
 */
export const getEarningsHistory = async (
  recipientUserId?: number,
  role?: 'Owner' | 'Jockey'
): Promise<EarningsHistoryItem[]> => {
  const params = new URLSearchParams();

  if (recipientUserId) {
    params.set('recipientUserId', String(recipientUserId));
  }

  if (role) {
    params.set('role', role);
  }

  const query = params.toString()
    ? `?${params.toString()}`
    : '';

  const res = await apiFetch<
    ApiResponse<EarningsHistoryItem[]>
  >(`/payouts/earnings-history${query}`);

  if (!res.success) {
    throw new Error(
      res.message || 'Không tải được lịch sử thu nhập.'
    );
  }

  return res.data ?? [];
};
