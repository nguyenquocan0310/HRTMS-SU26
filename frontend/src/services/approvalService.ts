// ─── Service duyệt hồ sơ (Approval Center) ──────────────────────────────────
// Gọi API thật BE: /api/admin/...

import { apiFetch } from './apiClient';

// ── NGỰA (Horse Entry / Enrollment) ─────────────────────────────────────────
export interface HorseEnrollmentPending {
  enrollmentId: number;
  horseId: number;
  horseName: string;
  tournamentId: number;
  tournamentName: string;
  status: string;
  screeningStatus: string;
  screeningReason: string | null;
  adminApprovalStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export const getPendingHorses = async (): Promise<HorseEnrollmentPending[]> => {
  const res = await apiFetch<{ success: boolean; message: string; data: HorseEnrollmentPending[] }>(
    '/admin/horse-entries/pending?page=1&pageSize=50'
  );
  return res.data ?? [];
};

export const approveHorse = (enrollmentId: number): Promise<unknown> =>
  apiFetch(`/admin/horse-entries/${enrollmentId}/approve`, { method: 'PATCH' });

export const rejectHorse = (enrollmentId: number, reason: string): Promise<unknown> =>
  apiFetch(`/admin/horse-entries/${enrollmentId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });

export interface HorseDetail {
  horseId: number;
  breed: string;
  vaccinationRecordRef: string;
  dopingTestResult: string;
}

export const getHorseDetail = async (horseId: number): Promise<HorseDetail> => {
  const res = await apiFetch<{ success: boolean; data: HorseDetail }>(`/admin/horses/${horseId}`);
  if (!res.success || !res.data) throw new Error('Không tải được chi tiết ngựa.');
  return res.data;
};

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
