import { apiFetch, apiFetchBlob } from './apiClient';

export type FeePaymentStatus = 'PendingVerification' | 'Verified' | 'Rejected';
export type AdminFeePairingStatus = 'All' | 'NoPayment' | FeePaymentStatus;
export interface FeePayment { paymentId: number; pairingId: number; tournamentId: number; tournamentName: string; horseId: number; horseName: string; jockeyId: number; jockeyName: string; ownerId: number; ownerName: string; amount: number; method: 'Cash' | 'Transfer'; receiptNo: string | null; transferRef: string | null; proofFileName: string | null; hasProof: boolean; status: FeePaymentStatus; submittedAt: string; verifiedBy: number | null; verifiedAt: string | null; rejectReason: string | null; pairingStatus: string; }
export interface FeePaymentPage { items: FeePayment[]; page: number; pageSize: number; totalCount: number; totalPages: number; }
export interface FeePaymentFilters { status: FeePaymentStatus; tournamentId?: number; page?: number; pageSize?: number; }
export interface AdminFeePairing {
  pairingId: number; tournamentId: number; tournamentName: string; horseId: number; horseName: string;
  jockeyId: number; jockeyName: string; ownerId: number; ownerName: string; pairingStatus: string;
  pairingResponseReason: string | null; pairingCreatedAt: string; paymentId: number | null; amount: number | null;
  method: 'Cash' | 'Transfer' | null; receiptNo: string | null; transferRef: string | null;
  proofFileName: string | null; hasProof: boolean; paymentStatus: FeePaymentStatus | null;
  submittedAt: string | null; verifiedAt: string | null; rejectReason: string | null; canRejectUnpaid: boolean;
}
export interface AdminFeePairingPage { items: AdminFeePairing[]; page: number; pageSize: number; totalCount: number; totalPages: number; }

export const getFeePayments = (filters: FeePaymentFilters) => {
  const params = new URLSearchParams({ status: filters.status, page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 20) });
  if (filters.tournamentId) params.set('tournamentId', String(filters.tournamentId));
  return apiFetch<FeePaymentPage>(`/admin/fee-payments?${params}`);
};
export const getAdminFeePairings = (filters: { status: AdminFeePairingStatus; tournamentId?: number; page?: number; pageSize?: number }) => {
  const params = new URLSearchParams({ paymentStatus: filters.status, page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 20) });
  if (filters.tournamentId) params.set('tournamentId', String(filters.tournamentId));
  return apiFetch<AdminFeePairingPage>(`/admin/pairing-fee-statuses?${params}`);
};
export const verifyFeePayment = (paymentId: number) => apiFetch<FeePayment>(`/admin/fee-payments/${paymentId}/verify`, { method: 'POST' });
export const rejectFeePayment = (paymentId: number, reason: string) => apiFetch<FeePayment>(`/admin/fee-payments/${paymentId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
export const rejectUnpaidPairing = (pairingId: number, reason: string) => apiFetch<AdminFeePairing>(`/admin/pairings/${pairingId}/reject-unpaid`, { method: 'POST', body: JSON.stringify({ reason }) });
export const getFeeProof = (paymentId: number) => apiFetchBlob(`/fee-payments/${paymentId}/proof`);
