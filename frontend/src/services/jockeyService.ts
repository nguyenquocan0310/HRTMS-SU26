import axios, { AxiosInstance } from 'axios';
import type {
  JockeyProfile,
  RaceInvitation,
  JockeyRaceEntry,
  JockeyRaceResult,
} from '../types/jockey.types';

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
      '/api/jockeys/my-profile'
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching jockey profile:', error);
    throw error;
  }
};

/**
 * Get all race invitations for the current jockey
 */
export const getMyInvitations = async (): Promise<RaceInvitation[]> => {
  try {
    const response = await axiosInstance.get<RaceInvitation[]>(
      '/api/jockey-invitations/my'
    );
    return response.data;
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
  status: 'Accept' | 'Decline'
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
