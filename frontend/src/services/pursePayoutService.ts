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