import axios from 'axios';
import type  { AxiosInstance } from 'axios';
import type {
  JockeyProfile,
  JockeyRaceEntry,
  JockeyRaceResult,
} from '../types/jockey.types';
import { apiFetch } from './apiClient';

const API_URL = import.meta.env.VITE_API_URL;

// Create axios instance
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

/**
 * Get the current jockey's profile information
 */
export const getMyProfile = async (): Promise<JockeyProfile> => {
  try {
    const response = await axiosInstance.get<JockeyProfile>(
      'http://localhost:5222/api/jockeys/profile'
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching jockey profile:', error);
    throw error;
  }
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
  try {
    const response = await axiosInstance.patch<{ message: string }>(
      'http://localhost:5222/api/jockeys/profile',
      payload
    );
    return response.data;
  } catch (error) {
    console.error('Error updating jockey profile:', error);
    throw error;
  }
};


/**
 * Get all race invitations for the current jockey
 */
export const getMyInvitations = async (
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<any[]> => {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('page', String(page));
    params.append('pageSize', String(pageSize));

    const response = await axiosInstance.get<any>(
      `http://localhost:5222/api/jockeys/invitations?${params.toString()}`
    );
    const data = response.data;

    // Extract array of invitations
    if (Array.isArray(data)) return data;
    if (data && data.data) {
      if (Array.isArray(data.data)) return data.data;
      if (data.data.items && Array.isArray(data.data.items)) return data.data.items;
    }
    if (data && data.items && Array.isArray(data.items)) return data.items;
    return [];
  } catch (error) {
    console.error('Error fetching jockey invitations:', error);
    throw error;
  }
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
  try {
    const response = await axiosInstance.get<JockeyRaceEntry[]>(
      '/api/race-entries/jockey/my'
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching jockey races:', error);
    throw error;
  }
};

/**
 * Get race history/results for the current jockey
 */
export const getMyRaceHistory = async (): Promise<JockeyRaceResult[]> => {
  try {
    const response = await axiosInstance.get<JockeyRaceResult[]>(
      '/api/race-results/jockey/my'
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching jockey race history:', error);
    throw error;
  }
};

/**
 * PATCH /api/pairings/{id}/accept
 * Jockey chấp nhận lời mời của Owner.
 */
export const acceptPairing = async (pairingId: string): Promise<any> => {
  interface ApiResp<T> { success: boolean; message: string; data: T | null }
  const res = await apiFetch<ApiResp<any>>(`/pairings/${pairingId}/accept`, {
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
  interface ApiResp<T> { success: boolean; message: string; data: T | null }
  const res = await apiFetch<ApiResp<any>>(`/pairings/${pairingId}/decline`, {
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
 * const res = await axiosInstance.post('/jockeys/certificate/upload', form, {
 *   headers: { 'Content-Type': 'multipart/form-data' },
 * });
 * return { url: res.data.url, fileName: file.name };
 */
export const uploadCertificateFile = async (
  file: File
): Promise<{ url: string; fileName: string }> => {
  return { url: URL.createObjectURL(file), fileName: file.name };
};