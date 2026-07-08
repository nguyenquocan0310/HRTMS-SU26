import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { Horse, RaceEntry, JockeyInvitation } from '../types/owner.types';
import { apiFetch } from './apiClient';

const API_URL = import.meta.env.VITE_API_URL;

// Create axios instance (dùng cho các hàm chưa được migrate sang apiFetch)
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
});

// Add JWT token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ─── Horse CRUD (dùng apiFetch — không hard-code localhost) ──────────────────

export const getMyHorses = async (): Promise<Horse[]> => {
  try {
    const res = await apiFetch<any>('/horses/my');
    // Backend trả ApiResponse<T> hoặc thẳng array
    return res?.data || (Array.isArray(res) ? res : []);
  } catch (error) {
    console.error('Error fetching my horses:', error);
    throw error;
  }
};

export const getHorseById = async (id: number): Promise<Horse> => {
  try {
    const res = await apiFetch<any>(`/horses/${id}`);
    return res?.data || res;
  } catch (error) {
    console.error(`Error fetching horse with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new horse
 */
export const createHorse = async (
  data: Omit<Horse, 'horseID' | 'ownerID' | 'createdAt'>
): Promise<Horse> => {
  try {
    const res = await apiFetch<any>('/horses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res?.data || res;
  } catch (error) {
    console.error('Error creating horse:', error);
    throw error;
  }
};

/**
 * Update an existing horse
 */
export const updateHorse = async (
  id: number,
  data: Partial<Horse>
): Promise<Horse> => {
  try {
    const response = await axiosInstance.put<Horse>(`/api/horses/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(`Error updating horse with ID ${id}:`, error);
    throw error;
  }
};

/**
 * GET /api/horses/{horseId}/enrollments
 * Trả về danh sách enrollment của ngựa theo từng giải.
 * Trả về null nếu lỗi mạng — caller sẽ hiển thị fallback thay vì crash.
 * Trả về [] nếu thành công nhưng không có enrollment nào.
 */
export const getHorseEnrollments = async (
  horseId: number | string
): Promise<HorseEnrollmentResponse[] | null> => {
  try {
    const res = await apiFetch<any>(`/horses/${horseId}/enrollments`);
    // Backend có thể trả ApiResponse<list> hoặc thẳng array
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.items)) return res.data.items;
    // Single enrollment wrapped in data
    if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) return [res.data];
    return [];
  } catch (error) {
    console.error(`Error fetching enrollments for horse ${horseId}:`, error);
    return null; // null = network error; [] = no enrollments
  }
};

/**
 * Get all race entries for the current user's horses
 */
export const getMyRaceEntries = async (
  status?: string,
  entryFeeStatus?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<RaceEntry[]> => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (entryFeeStatus) params.set('entryFeeStatus', entryFeeStatus);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  interface ApiResponse<T> { success: boolean; message: string; data: T | null }
  const res = await apiFetch<ApiResponse<RaceEntry[]>>(`/race-entries/my?${params.toString()}`);
  if (!res.success || !res.data) throw new Error(res.message || 'Không tải được danh sách đăng ký.');
  return res.data;
};


/**
 * Get all jockey invitations for the current user
 */
export const getMyJockeyInvitations = async (): Promise<JockeyInvitation[]> => {
  try {
    const response = await axiosInstance.get<JockeyInvitation[]>('/api/jockey-invitations/my');
    return response.data;
  } catch (error) {
    console.error('Error fetching my jockey invitations:', error);
    throw error;
  }
};

/**
 * Get available jockeys for a tournament
 */
export const getAvailableJockeys = async (tournamentId: number = 1, page: number = 1, pageSize: number = 20): Promise<any[]> => {
  try {
    const response = await axiosInstance.get<any>(`http://localhost:5222/api/jockeys/available?tournamentId=${tournamentId}&page=${page}&pageSize=${pageSize}`);
    const data = response.data;

    // Extract array of jockeys from standard API response envelopes
    if (Array.isArray(data)) return data;
    if (data && data.data) {
      if (Array.isArray(data.data)) return data.data;
      if (data.data.items && Array.isArray(data.data.items)) return data.data.items;
    }
    if (data && data.items && Array.isArray(data.items)) return data.items;
    return [];
  } catch (error) {
    console.error('Error fetching available jockeys:', error);
    throw error;
  }
};

/**
 * Get owner pairings (invitations) with status/horse filter
 */
export const getOwnerPairings = async (
  status?: string,
  horseId?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<any[]> => {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (horseId) params.append('horseId', horseId);
    params.append('page', String(page));
    params.append('pageSize', String(pageSize));

    const response = await axiosInstance.get<any>(`http://localhost:5222/api/owner/pairings?${params.toString()}`);
    const data = response.data;

    // Extract array of pairings from standard API response envelopes
    if (Array.isArray(data)) return data;
    if (data && data.data) {
      if (Array.isArray(data.data)) return data.data;
      if (data.data.items && Array.isArray(data.data.items)) return data.data.items;
    }
    if (data && data.items && Array.isArray(data.items)) return data.items;
    return [];
  } catch (error) {
    console.error('Error fetching owner pairings:', error);
    throw error;
  }
};

export interface InviteJockeyPayload {
  tournamentId?: number;
  horseId: number;
  jockeyId: number;
  requestMessage: string;
}

/**
 * POST /api/pairings
 * API trả trực tiếp PairingResponseDto (không có ApiResponse wrapper).
 * apiFetch sẽ throw nếu HTTP status không phải 2xx — không cần check .success.
 */
export const inviteJockey = async (payload: InviteJockeyPayload): Promise<any> => {
  return apiFetch<any>('/pairings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};



/**
 * Accept/Confirm a pairing invitation
 */
export const acceptPairing = async (pairingId: string): Promise<any> => {
  try {
    const response = await axiosInstance.patch<any>(
      `http://localhost:5222/api/pairings/${pairingId}/accept`
    );
    return response.data;
  } catch (error) {
    console.error(`Error accepting pairing ${pairingId}:`, error);
    throw error;
  }
};

/**
 * PATCH /api/pairings/{id}/confirm
 * Owner xác nhận ghép cặp sau khi Jockey đã accept.
 * Pairing chuyển từ Accepted → Confirmed.
 */
export const confirmPairing = async (pairingId: string | number): Promise<any> => {
  interface ApiResponse<T> { success: boolean; message: string; data: T | null }
  const res = await apiFetch<ApiResponse<any>>(`/pairings/${pairingId}/confirm`, {
    method: 'PATCH',
  });
  // Backend trả success:false với message chi tiết khi nghiệp vụ không hợp lệ
  if (res && res.success === false) {
    throw new Error(res.message || 'Xác nhận ghép cặp thất bại.');
  }
  return res?.data ?? res;
};

// ─── Horse + Tournament Registration (dùng apiFetch — không hard-code localhost) ───

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface HorseCreatePayload {
  name: string;
  birthYear: number;
  gender: string;
  color: string;
  pedigree?: string;
  weight: number;
  identifyingMarks: string;
  breed: string;
  vaccinationRecordRef?: string;
  dopingTestDate?: string;
  dopingTestResult?: string;
  legalConsentAccepted: boolean;
}

export interface HorseCreateResponse {
  horseId: number;
  name: string;
  breed: string;
  birthYear: number;
  gender: string;
  color: string;
  weight: number;
  identifyingMarks: string;
  screeningStatus?: 'AutoEligible' | 'ManualReview' | 'AutoRejected' | string;
  screeningReason?: string | null;
  adminApprovalStatus?: string | null;
  enrollmentId?: number;
  tournamentId?: number;
  tournamentName?: string | null;
  enrollmentStatus?: string;
}

export interface HorseEnrollmentResponse {
  enrollmentId: number;
  horseId: number;
  horseName: string;
  tournamentId: number;
  tournamentName: string | null;
  status: string;
  screeningStatus: 'AutoEligible' | 'ManualReview' | 'AutoRejected' | string;
  screeningReason: string | null;
  adminApprovalStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST /api/horses/{horseId}/enrollments
 * Đưa một hồ sơ ngựa đã có trong kho vào một giải cụ thể để backend screening theo giải.
 */
export const enrollHorseToTournament = async (
  horseId: number | string,
  tournamentId: number
): Promise<HorseEnrollmentResponse> => {
  const res = await apiFetch<ApiResponse<HorseEnrollmentResponse>>(
    `/horses/${horseId}/enrollments`,
    {
      method: 'POST',
      body: JSON.stringify({ tournamentId }),
    }
  );

  if (!res.success || !res.data) {
    throw new Error(res.message || 'Đăng ký ngựa vào giải thất bại.');
  }

  return res.data;
};

/**
 * POST /api/horses
 * Chỉ tạo hồ sơ ngựa trong kho/stable, không gắn giải.
 */
export const createHorseProfile = async (
  payload: HorseCreatePayload
): Promise<HorseCreateResponse> => {
  const horseRes = await apiFetch<ApiResponse<HorseCreateResponse>>('/horses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!horseRes.success || !horseRes.data) {
    throw new Error(horseRes.message || 'Tạo hồ sơ ngựa thất bại.');
  }

  return horseRes.data;
};
/**
 * PATCH /api/race-entries/{id}/confirm
 */
export const confirmRaceEntry = async (id: number): Promise<any> => {
  interface ApiResponse<T> { success: boolean; message: string; data: T | null }
  const res = await apiFetch<ApiResponse<any>>(`/race-entries/${id}/confirm`, {
    method: 'PATCH',
  });
  if (!res.success) throw new Error(res.message || 'Xác nhận tham gia thất bại.');
  return res.data;
};

/**
 * DELETE /api/race-entries/{id}?reason={reason}
 */
export const withdrawRaceEntry = async (id: number, reason: string): Promise<any> => {
  interface ApiResponse<T> { success: boolean; message: string; data: T | null }
  const params = new URLSearchParams();
  params.set('reason', reason);
  const res = await apiFetch<ApiResponse<any>>(`/race-entries/${id}?${params.toString()}`, {
    method: 'DELETE',
  });
  if (!res.success) throw new Error(res.message || 'Rút lui thất bại.');
  return res.data;
};


