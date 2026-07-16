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