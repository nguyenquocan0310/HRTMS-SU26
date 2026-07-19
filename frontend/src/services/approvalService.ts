// ─── Service duyệt hồ sơ — Approval Center ──────────────────────────────────

import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

// ─── HORSE ENROLLMENT ───────────────────────────────────────────────────────

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

export const getPendingHorses =
  async (): Promise<HorseEnrollmentPending[]> => {
    const res = await apiFetch<
      ApiResponse<HorseEnrollmentPending[]>
    >('/admin/horse-entries/pending?page=1&pageSize=50');

    if (!res.success) {
      throw new Error(
        res.message ||
          'Không tải được danh sách hồ sơ ngựa.'
      );
    }

    return res.data ?? [];
  };

export const approveHorse = async (
  enrollmentId: number
): Promise<void> => {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/admin/horse-entries/${enrollmentId}/approve`,
    {
      method: 'PATCH',
    }
  );

  if (!res.success) {
    throw new Error(
      res.message || 'Duyệt hồ sơ ngựa thất bại.'
    );
  }
};

export const rejectHorse = async (
  enrollmentId: number,
  reason: string
): Promise<void> => {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/admin/horse-entries/${enrollmentId}/reject`,
    {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }
  );

  if (!res.success) {
    throw new Error(
      res.message || 'Từ chối hồ sơ ngựa thất bại.'
    );
  }
};

// ─── HORSE DETAIL ───────────────────────────────────────────────────────────

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

export const getHorseDetail = async (
  horseId: number
): Promise<HorseDetail> => {
  const res = await apiFetch<ApiResponse<HorseDetail>>(
    `/admin/horses/${horseId}`
  );

  if (!res.success || !res.data) {
    throw new Error(
      res.message ||
        'Không tải được thông tin chi tiết ngựa.'
    );
  }

  return res.data;
};

// ─── PERSONNEL PENDING APPROVALS ────────────────────────────────────────────

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

export interface PendingApprovalsData {
  referees: PersonPending[];
  doctors: PersonPending[];
  jockeys: PersonPending[];
}

export const getPendingApprovals =
  async (): Promise<PendingApprovalsData> => {
    const res = await apiFetch<
      ApiResponse<PendingApprovalsData>
    >('/admin/pending-approvals');

    if (!res.success) {
      throw new Error(
        res.message ||
          'Không tải được danh sách hồ sơ đang chờ duyệt.'
      );
    }

    return (
      res.data ?? {
        referees: [],
        doctors: [],
        jockeys: [],
      }
    );
  };

// ─── JOCKEY APPROVAL ────────────────────────────────────────────────────────

export const approveJockey = async (
  userId: number
): Promise<void> => {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/admin/jockeys/${userId}/approve`,
    {
      method: 'PATCH',
    }
  );

  if (!res.success) {
    throw new Error(
      res.message || 'Duyệt hồ sơ Jockey thất bại.'
    );
  }
};

export const rejectJockey = async (
  userId: number,
  reason: string
): Promise<void> => {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/admin/jockeys/${userId}/reject`,
    {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }
  );

  if (!res.success) {
    throw new Error(
      res.message ||
        'Từ chối hồ sơ Jockey thất bại.'
    );
  }
};

// ─── REFEREE APPROVAL ───────────────────────────────────────────────────────

export const approveReferee = async (
  userId: number
): Promise<void> => {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/admin/referees/${userId}/approve`,
    {
      method: 'PATCH',
    }
  );

  if (!res.success) {
    throw new Error(
      res.message ||
        'Duyệt hồ sơ Trọng tài thất bại.'
    );
  }
};

export const rejectReferee = async (
  userId: number,
  reason: string
): Promise<void> => {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/admin/referees/${userId}/reject`,
    {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }
  );

  if (!res.success) {
    throw new Error(
      res.message ||
        'Từ chối hồ sơ Trọng tài thất bại.'
    );
  }
};

// ─── DOCTOR APPROVAL ────────────────────────────────────────────────────────

export const approveDoctor = async (
  userId: number
): Promise<void> => {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/admin/doctors/${userId}/approve`,
    {
      method: 'PATCH',
    }
  );

  if (!res.success) {
    throw new Error(
      res.message ||
        'Duyệt hồ sơ Bác sĩ thất bại.'
    );
  }
};

export const rejectDoctor = async (
  userId: number,
  reason: string
): Promise<void> => {
  const res = await apiFetch<ApiResponse<unknown>>(
    `/admin/doctors/${userId}/reject`,
    {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }
  );

  if (!res.success) {
    throw new Error(
      res.message ||
        'Từ chối hồ sơ Bác sĩ thất bại.'
    );
  }
};

// ─── ACTIVE USERS — ASSIGN OFFICIALS ────────────────────────────────────────

export interface ActiveUser {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export const getActiveUsersByRole = async (
  role: 'Referee' | 'Doctor'
): Promise<ActiveUser[]> => {
  const params = new URLSearchParams({
    role,
    status: 'Active',
  });

  const res = await apiFetch<
    ApiResponse<ActiveUser[]>
  >(`/admin/users?${params.toString()}`);

  if (!res.success) {
    throw new Error(
      res.message ||
        'Không tải được danh sách người dùng khả dụng.'
    );
  }

  return res.data ?? [];
};

// Tra cứu tên user theo ID — dùng để hiển thị "Người gửi" ở protest, vì
// ProtestDto chỉ trả submittedByUserId (số), không có tên kèm theo.
export interface UserBasicInfo {
  userId: number;
  fullName: string;
}

export const getUserBasicInfo = async (userId: number): Promise<UserBasicInfo | null> => {
  try {
    const res = await apiFetch<{ success: boolean; data: { userId: number; fullName: string } }>(
      `/admin/users/${userId}`
    );
    if (!res.success || !res.data) return null;
    return { userId: res.data.userId, fullName: res.data.fullName };
  } catch {
    return null;
  }
};

