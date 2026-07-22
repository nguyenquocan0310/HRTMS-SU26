import { apiFetch } from './apiClient';

export type TrackType = 'Dirt' | 'Turf' | 'Synthetic';
export interface Venue { venueId: number; name: string; address: string | null; city: string | null; trackType: TrackType; trackLengthMeters: number; laneCount: number; isActive: boolean; createdAt: string; updatedAt: string; }
export interface VenuePayload { name?: string; address?: string; city?: string; trackType?: TrackType; trackLengthMeters?: number; laneCount?: number; isActive?: boolean; }
export interface VenueFilters { search?: string; city?: string; trackType?: TrackType; isActive?: boolean; }

const query = (filters: VenueFilters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  return params.toString();
};

export const getVenues = () => apiFetch<Venue[]>('/venues');
export const getVenue = (venueId: number) => apiFetch<Venue>(`/venues/${venueId}`);
export const getAdminVenues = (filters: VenueFilters = {}) => apiFetch<Venue[]>(`/admin/venues${query(filters) ? `?${query(filters)}` : ''}`);
export const createVenue = (payload: Required<VenuePayload>) => apiFetch<Venue>('/admin/venues', { method: 'POST', body: JSON.stringify(payload) });
export const updateVenue = (venueId: number, payload: VenuePayload) => apiFetch<Venue>(`/admin/venues/${venueId}`, { method: 'PUT', body: JSON.stringify(payload) });
