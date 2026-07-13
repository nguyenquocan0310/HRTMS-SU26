import { apiFetch } from './apiClient';

// ─── Referee ───────────────────────────────────────────────────────────────

export interface RefereeAssignment {
  raceId: number;
  refereeId: number;
  refereeName: string;
  refereeEmail: string;
  certificationLevel: string;
  role: string;
  assignedAt: string;
}

export const getRefereesByRace = (raceId: number): Promise<RefereeAssignment[]> =>
  apiFetch<RefereeAssignment[]>(`/admin/races/${raceId}/referees`)
    .catch(() => []);

export const assignReferee = (raceId: number, refereeId: number, role: string): Promise<RefereeAssignment> =>
  apiFetch<RefereeAssignment>(`/admin/races/${raceId}/referees`, {
    method: 'POST',
    body: JSON.stringify({ refereeId, role }),
  });

export const removeReferee = (raceId: number, refereeId: number): Promise<void> =>
  apiFetch(`/admin/races/${raceId}/referees/${refereeId}`, { method: 'DELETE' });

// ─── Doctor ────────────────────────────────────────────────────────────────

export interface DoctorAssignment {
  raceId: number;
  doctorId: number;
  doctorName: string;
  doctorEmail: string;
  medicalLicenseNumber: string;
  assignedAt: string;
  certifiedAt: string | null;
}

export const getDoctorsByRace = (raceId: number): Promise<DoctorAssignment[]> =>
  apiFetch<DoctorAssignment[]>(`/admin/races/${raceId}/doctors`)
    .catch(() => []);

export const assignDoctor = (raceId: number, doctorId: number): Promise<DoctorAssignment> =>
  apiFetch<DoctorAssignment>(`/admin/races/${raceId}/doctors`, {
    method: 'POST',
    body: JSON.stringify({ doctorId }),
  });

export const removeDoctor = (raceId: number, doctorId: number): Promise<void> =>
  apiFetch(`/admin/races/${raceId}/doctors/${doctorId}`, { method: 'DELETE' });