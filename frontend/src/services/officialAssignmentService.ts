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


// Danh sách cán bộ đủ điều kiện phân công cho MỘT race cụ thể — đã lọc theo
// TournamentParticipants Approved đúng giải + loại người đang bận race khác
// cùng giờ. Đây là nguồn đúng cho modal Assign, thay cho getActiveUsersByRole
// (chỉ lọc Active, không kiểm tra roster/tournament/trùng giờ).
export interface AvailableOfficial {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  profileStatus: string;
  certificationLevel: string | null;
  createdAt: string;
}

interface AvailableOfficialsResponse {
  referees: AvailableOfficial[];
  doctors: AvailableOfficial[];
}

export const getAvailableOfficials = (raceId: number): Promise<AvailableOfficialsResponse> =>
  apiFetch<{ success: boolean; data: AvailableOfficialsResponse }>(
    `/admin/races/${raceId}/available-officials`
  ).then((res) => res.data ?? { referees: [], doctors: [] });