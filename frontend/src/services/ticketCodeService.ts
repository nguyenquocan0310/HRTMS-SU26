import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T | null;
}

export interface CreateTicketCodesPayload {
  quantity: number;
  rewardAmount: number;
  expiresAt: string;
}

export interface CreateTicketCodesResult {
  count: number;
  rewardAmount: number;
  expiresAt: string;
  codes: string[];
}

/**
 * POST /api/admin/ticket-codes
 * Role: Admin
 *
 * Body:
 * {
 *   quantity: number,
 *   rewardAmount: number,
 *   expiresAt: ISO string
 * }
 */
export const createTicketCodes = async (
  payload: CreateTicketCodesPayload
): Promise<CreateTicketCodesResult> => {
  const res = await apiFetch<
    ApiResponse<CreateTicketCodesResult>
  >('/admin/ticket-codes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.success || !res.data) {
    throw new Error(
      res.message || 'Không thể tạo mã ticket.'
    );
  }

  return res.data;
};

export type TicketCodeStatus = 'Active' | 'Redeemed' | 'Expired';

export interface TicketCodeListItem {
  id: number;
  code: string;
  pointAmount: number;
  status: TicketCodeStatus;
  expiresAt: string;
  createdAt: string;
  redeemedBySpectatorName: string | null;
  redeemedAt: string | null;
}

export interface TicketCodeListResult {
  items: TicketCodeListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * GET /api/admin/ticket-codes?status=&page=&pageSize=
 * Role: Admin
 */
export const getTicketCodes = async (params: {
  status?: TicketCodeStatus | '';
  page?: number;
  pageSize?: number;
}): Promise<TicketCodeListResult> => {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 20));

  const res = await apiFetch<ApiResponse<TicketCodeListResult>>(
    `/admin/ticket-codes?${query.toString()}`
  );

  if (!res.success || !res.data) {
    throw new Error(res.message || 'Không thể tải danh sách mã.');
  }

  return res.data;
};