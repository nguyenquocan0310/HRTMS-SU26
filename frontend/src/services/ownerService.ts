import axios, { AxiosInstance } from 'axios';
import { Horse, RaceEntry, JockeyInvitation } from '../types/owner.types';

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
 * Get all horses owned by the current user
 */
export const getMyHorses = async (): Promise<Horse[]> => {
  try {
    const response = await axiosInstance.get<Horse[]>('/api/horses/my');
    return response.data;
  } catch (error) {
    console.error('Error fetching my horses:', error);
    throw error;
  }
};

/**
 * Get a specific horse by ID
 */
export const getHorseById = async (id: number): Promise<Horse> => {
  try {
    const response = await axiosInstance.get<Horse>(`/api/horses/${id}`);
    return response.data;
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
    const response = await axiosInstance.post<Horse>('/api/horses', data);
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
    const response = await axiosInstance.get<JockeyInvitation[]>(
      '/api/jockey-invitations/my'
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching my jockey invitations:', error);
    throw error;
  }
};
