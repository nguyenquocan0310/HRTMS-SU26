import type {
  JockeyCareerStats,
  JockeyProfile,
  JockeyRaceEntry,
  JockeyRaceResult,
} from '../types/jockey.types';
import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

const unwrap = <T>(response: ApiResponse<T> | T): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    const wrapped = response as ApiResponse<T>;
    if (wrapped.success === false || wrapped.data == null) {
      throw new Error(wrapped.message || 'API trả về dữ liệu không hợp lệ.');
    }
    return wrapped.data;
  }
  return response as T;
};

const positiveJockeyId = (jockeyId: number): number => {
  if (!Number.isInteger(jockeyId) || jockeyId <= 0) {
    throw new Error('jockeyId phải là số nguyên dương.');
  }
  return jockeyId;
};

/**
 * Get the current jockey's profile information
 */
export const getMyProfile = async (): Promise<JockeyProfile> => {
  const response = await apiFetch<ApiResponse<JockeyProfile> | JockeyProfile>('/jockeys/profile');
  return unwrap(response);
};

/**
 * Update the current jockey's professional profile
 */
export interface UpdateProfilePayload {
  licenseCertificate: string;
  experienceYears: number;
  bloodType: string;
  healthStatus: string;
  selfDeclaredWeight: number;
}

export const updateMyProfile = async (
  payload: UpdateProfilePayload
): Promise<{ message: string }> => {
  const response = await apiFetch<ApiResponse<{ message: string }> | { message: string }>(
    '/jockeys/profile',
    { method: 'PATCH', body: JSON.stringify(payload) }
  );
  return unwrap(response);
};


/**
 * Get all race invitations for the current jockey
 */
export const getMyInvitations = async (
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<any[]> => {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', String(page));
  params.append('pageSize', String(pageSize));

  const data = await apiFetch<any>(`/jockeys/invitations?${params.toString()}`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

/**
 * Respond to a race invitation — DEPRECATED, kept for safety.
 * Use acceptPairing / declinePairing instead.
 */
export const respondToInvitation = async (
  _invitationID: string,
  _status: 'Accepted' | 'Declined'
): Promise<void> => {
  console.warn('respondToInvitation is deprecated. Use acceptPairing or declinePairing.');
};

/**
 * Get all upcoming races for the current jockey
 */
export const getMyRaces = async (): Promise<JockeyRaceEntry[]> => {
  const response = await apiFetch<ApiResponse<JockeyRaceEntry[]> | JockeyRaceEntry[]>(
    '/race-entries/jockey/my'
  );
  return unwrap(response);
};

/**
 * Get race history/results for the current jockey
 */
export const getMyRaceHistory = async (): Promise<JockeyRaceResult[]> => {
  const response = await apiFetch<ApiResponse<JockeyRaceResult[]> | JockeyRaceResult[]>(
    '/race-results/jockey/my'
  );
  return unwrap(response);
};

/** GET /api/jockeys/stats/my — jockeyId is resolved by the backend from JWT. */
export const getMyCareerStats = async (): Promise<JockeyCareerStats> => {
  const response = await apiFetch<ApiResponse<JockeyCareerStats> | JockeyCareerStats>(
    '/jockeys/stats/my'
  );
  return unwrap(response);
};

/** GET /api/jockeys/{jockeyId}/stats */
export const getJockeyCareerStats = async (jockeyId: number): Promise<JockeyCareerStats> => {
  const id = positiveJockeyId(jockeyId);
  const response = await apiFetch<ApiResponse<JockeyCareerStats> | JockeyCareerStats>(
    `/jockeys/${id}/stats`
  );
  return unwrap(response);
};

/**
 * PATCH /api/pairings/{id}/accept
 * Jockey chấp nhận lời mời của Owner.
 */
export const acceptPairing = async (pairingId: string): Promise<any> => {
  const res = await apiFetch<ApiResponse<any>>(`/pairings/${pairingId}/accept`, {
    method: 'PATCH',
  });
  if (res && res.success === false) {
    throw new Error(res.message || 'Chấp nhận lời mời thất bại.');
  }
  return res?.data ?? res;
};

/**
 * PATCH /api/pairings/{id}/decline
 * Jockey từ chối lời mời của Owner.
 * @param responseReason - Lý do từ chối (tuyện chọn, có giá trị mặc định)
 */
export const declinePairing = async (
  pairingId: string,
  responseReason: string = 'Jockey từ chối lời mời.'
): Promise<any> => {
  const res = await apiFetch<ApiResponse<any>>(`/pairings/${pairingId}/decline`, {
    method: 'PATCH',
    body: JSON.stringify({ responseReason }),
  });
  if (res && res.success === false) {
    throw new Error(res.message || 'Từ chối lời mời thất bại.');
  }
  return res?.data ?? res;
};

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get all race entries for the current jockey
 */
export const getMyJockeyRaceEntries = async (
  page: number = 1,
  pageSize: number = 20
): Promise<PagedResult<JockeyRaceEntry>> => {
  return apiFetch<PagedResult<JockeyRaceEntry>>(
    `/jockeys/race-entries/my?page=${page}&pageSize=${pageSize}`
  );
};


/**
 * Upload chứng chỉ hành nghề (ảnh/pdf).
 * TODO: BE chưa có endpoint — hiện tạm dùng blob URL local để preview.
 * Khi BE xong, thay thân hàm bằng:
 *
 * const form = new FormData();
 * form.append('file', file);
 * const res = await apiFetch<{ url: string }>('/jockeys/certificate/upload', {
 *   method: 'POST', body: form,
 * });
 * return { url: res.url, fileName: file.name };
 */
export const uploadCertificateFile = async (
  file: File
): Promise<{ url: string; fileName: string }> => {
  return { url: URL.createObjectURL(file), fileName: file.name };
};
