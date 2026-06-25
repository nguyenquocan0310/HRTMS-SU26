import axios from 'axios';
import type  { AxiosInstance } from 'axios';
import type { Horse, RaceEntry, JockeyInvitation } from '../types/owner.types';

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

export const getMyHorses = async (): Promise<Horse[]> => {
  try {
    const response = await axiosInstance.get<any>('http://localhost:5222/api/horses/my');
    // Trích xuất mảng ngựa từ thuộc tính .data của ApiResponse nếu có
    return response.data?.data || response.data || [];
  } catch (error) {
    console.error('Error fetching my horses:', error);
    throw error;
  }
};

export const getHorseById = async (id: number): Promise<Horse> => {
  try {
    const response = await axiosInstance.get<any>(`http://localhost:5222/api/horses/${id}`);
    return response.data?.data || response.data;
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
    const response = await axiosInstance.post<Horse>('http://localhost:5222/api/horses', data);
    return response.data;
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
 * Get all race entries for the current user's horses
 */
export const getMyRaceEntries = async (): Promise<RaceEntry[]> => {
  try {
    const response = await axiosInstance.get<RaceEntry[]>('/api/race-entries/my');
    return response.data;
  } catch (error) {
    console.error('Error fetching my race entries:', error);
    throw error;
  }
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

/**
 * Send an invitation to a jockey
 */
export const inviteJockey = async (payload: {
  horseId: string;
  jockeyId: string;
  requestMessage: string;
}): Promise<any> => {
  try {
    const response = await axiosInstance.post<any>('http://localhost:5222/api/pairings', payload);
    return response.data;
  } catch (error) {
    console.error('Error sending invitation:', error);
    throw error;
  }
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

