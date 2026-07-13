// ─── Service duyệt hồ sơ (Approval Center) ──────────────────────────────────
// Gọi API thật BE: /api/admin/...

import { apiFetch } from './apiClient';

// ── NGỰA (Horse Entry / Enrollment) ─────────────────────────────────────────

// Dữ liệu 1 dòng trong danh sách "pending" — theo đúng response thật
// GET /api/admin/horse-entries/pending (xác nhận qua Swagger).
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
  // Không catch nuốt lỗi — để lỗi thật hiện ra thay vì bảng rỗng câm.
  const res = await apiFetch<{ success: boolean; message: string; data: HorseEnrollmentPending[] }>(
    '/admin/horse-entries/pending?page=1&pageSize=50'
  );
  if (!res.success) throw new Error(res.message || 'Không tải được danh sách hồ sơ ngựa.');
  return res.data ?? [];
};

export const approveHorse = (enrollmentId: number): Promise<unknown> =>
  apiFetch(`/admin/horse-entries/${enrollmentId}/approve`, { method: 'PATCH' });

export const rejectHorse = (enrollmentId: number, reason: string): Promise<unknown> =>
  apiFetch(`/admin/horse-entries/${enrollmentId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });

// Chi tiết đầy đủ 1 con ngựa — theo đúng response thật GET /api/admin/horses/{id}.
// Enrollment DTO ở trên không có breed/vaccination/doping nên phải gọi riêng.
export interface HorseDetail {
  horseId: number;
  ownerId: number;
  name: string;
  birthYear: number;
  age: string;
  gender: string;
  color: string;
  pedigree: string;
  weight: number;
  identifyingMarks: string;
  breed: string;
  vaccinationRecordRef: string;
  dopingTestDate: string;
  dopingTestResult: string;
  legalConsentAccepted: boolean;
  screeningStatus: string;
  screeningReason: string | null;
  adminApprovalStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export const getHorseDetail = async (horseId: number): Promise<HorseDetail> => {
  const res = await apiFetch<{ success: boolean; message: string; data: HorseDetail }>(
    `/admin/horses/${horseId}`
  );
  if (!res.success || !res.data) throw new Error(res.message || 'Không tải được chi tiết ngựa.');
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

// ⚠️ Endpoint này hiện trả rỗng dù có tài khoản Pending thật — vấn đề đang
// chờ BE xác nhận riêng, CHƯA có kết luận cuối cùng ở thời điểm sửa file này.
export const getPendingApprovals = async (): Promise<PendingApprovalsData> => {
  const res = await apiFetch<{ success: boolean; message: string; data: PendingApprovalsData }>(
    '/admin/pending-approvals'
  );
  if (!res.success) throw new Error(res.message || 'Không tải được danh sách hồ sơ tài khoản.');
  return res.data ?? { referees: [], doctors: [], jockeys: [] };
};

export const approveJockey = (id: number): Promise<unknown> =>
  apiFetch(`/admin/jockeys/${id}/approve`, { method: 'PATCH' });

export const approveReferee = (id: number): Promise<unknown> =>
  apiFetch(`/admin/referees/${id}/approve`, { method: 'PATCH' });

export const approveDoctor = (id: number): Promise<unknown> =>
  apiFetch(`/admin/doctors/${id}/approve`, { method: 'PATCH' });


// ── Referee/Doctor Active — dùng cho modal Assign Officials (khác với
// pending-approvals vốn chỉ liệt kê hồ sơ đang CHỜ DUYỆT, không phải người đã Active) ──
export interface ActiveUser {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export const getActiveUsersByRole = async (role: 'Referee' | 'Doctor'): Promise<ActiveUser[]> => {
  const res = await apiFetch<{ success: boolean; data: ActiveUser[] }>(
    `/admin/users?role=${role}&status=Active`
  );
  return res.data ?? [];
};