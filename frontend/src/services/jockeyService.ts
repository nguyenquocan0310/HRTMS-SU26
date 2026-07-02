import axios from 'axios';
import type  { AxiosInstance } from 'axios';
import type {
  JockeyProfile,
  RaceInvitation,
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
 * Respond to a race invitation
 */
export const respondToInvitation = async (
  invitationID: string,
  status: 'Accepted' | 'Declined'
): Promise<void> => {
  try {
    await axiosInstance.put(
      `/api/jockey-invitations/${invitationID}/respond`,
      { status }
    );
  } catch (error) {
    console.error(
      `Error responding to invitation ${invitationID}:`,
      error
    );
    throw error;
  }
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
 * Accept a pairing invitation
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

