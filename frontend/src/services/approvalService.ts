// ─── Service duyệt hồ sơ (Approval Center) ──────────────────────────────────
// Gọi API thật BE: /api/admin/...

import { apiFetch } from './apiClient';

// ── NGỰA ────────────────────────────────────────────────────────────────────
export interface HorsePending {
  horseId: number;
  ownerId: number;
  name: string;
  breed: string;
  vaccinationRecordRef: string;
  dopingTestResult: string;
  adminApprovalStatus: string;
  createdAt: string;
}

export const getPendingHorses = async (): Promise<HorsePending[]> => {
  const res = await apiFetch<{ success: boolean; data: HorsePending[] }>(
    '/admin/horses/pending?page=1&pageSize=50'
  );
  return res.data ?? [];
};

export const approveHorse = (id: number): Promise<unknown> =>
  apiFetch(`/admin/horses-entries/${id}/approve`, { method: 'PATCH' });

export const rejectHorse = (id: number, reason: string): Promise<unknown> =>
  apiFetch(`/admin/horses-entries/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });

// ── JOCKEY / REFEREE / DOCTOR (personnel) ───────────────────────────────────
export interface PersonPending {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  profileStatus: string;
  certificationLevel: string | null;
  createdAt: string;
}

interface PendingApprovalsData {
  referees: PersonPending[];
  doctors: PersonPending[];
  jockeys: PersonPending[];
}

export const getPendingApprovals = async (): Promise<PendingApprovalsData> => {
  const res = await apiFetch<{ success: boolean; data: PendingApprovalsData }>(
    '/admin/pending-approvals'
  );
  return res.data ?? { referees: [], doctors: [], jockeys: [] };
};

export const approveJockey = (id: number): Promise<unknown> =>
  apiFetch(`/admin/jockeys/${id}/approve`, { method: 'PATCH' });

export const approveReferee = (id: number): Promise<unknown> =>
  apiFetch(`/admin/referees/${id}/approve`, { method: 'PATCH' });

export const approveDoctor = (id: number): Promise<unknown> =>
  apiFetch(`/admin/doctors/${id}/approve`, { method: 'PATCH' });
