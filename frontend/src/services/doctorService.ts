import { apiFetch } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DoctorProfessionalProfile {
  doctorId: number;
  username: string;
  fullName: string;
  email: string;
  medicalLicenseNumber: string;
  status: string;
  createdAt: string;
}

export interface UpdateDoctorProfilePayload {
  medicalLicenseNumber: string;
}

export interface UpdateDoctorProfileResult {
  doctorId: number;
  status: string;
  message: string;
}

export interface DoctorRaceAssignment {
  raceId: number;
  raceNumber: number;
  scheduledTime: string;
  raceStatus: string;
  roundId: number;
  roundName: string;
  tournamentId: number;
  tournamentName: string;
  assignmentRole: string | null;
  assignedAt: string;
}

export interface DoctorRaceEntry {
  raceEntryId: number;
  postPosition: number | null;
  status: string;
  entryFeeStatus: string | null;
  horseName: string;
  horseBreed: string | null;
  jockeyName: string;
  selfDeclaredWeight: number | null;
  preRaceJockeyWeight: number | null;
  weightDifference: number | null;
  thresholdKg: number | null;
  isWeightWarning: boolean;
  horseIdentityCheckStatus: string | null;
  clinicalStatus: string | null;
  unfitReason: string | null;
  isEmergencyDisqualified: boolean;
  raceEntryStatus: string | null;
  message?: string;
}

export interface PreRaceWeightResponse {
  raceEntryId: number;
  selfDeclaredWeight?: number | null;
  preRaceJockeyWeight?: number | null;
  preRaceWeight?: number | null;
  weightDifference?: number | null;
  thresholdKg?: number | null;
  isWeightWarning?: boolean;
  message?: string;
}

export interface HorseIdentityResponse {
  raceEntryId: number;
  horseIdentityCheckStatus?: string | null;
  horseIdentityStatus?: string | null;
  isEmergencyDisqualified?: boolean;
  raceEntryStatus?: string | null;
  message?: string;
}

export interface ClinicalCheckResponse {
  raceEntryId: number;
  clinicalStatus?: string | null;
  unfitReason?: string | null;
  isEmergencyDisqualified?: boolean;
  raceEntryStatus?: string | null;
  message?: string;
}

const normalizeRaceEntry = (item: any): DoctorRaceEntry | null => {
  const rawId = item?.raceEntryId ?? item?.id;
  const raceEntryId = Number(rawId);
  if (!Number.isFinite(raceEntryId)) return null;
  const selfDeclaredWeight = item?.selfDeclaredWeight ?? item?.jockey?.selfDeclaredWeight ?? null;
  const preRaceJockeyWeight = item?.preRaceJockeyWeight ?? item?.preRaceWeight ?? null;
  const computedWeightDifference =
    item?.weightDifference ??
    (typeof preRaceJockeyWeight === 'number' && typeof selfDeclaredWeight === 'number'
      ? Number((preRaceJockeyWeight - selfDeclaredWeight).toFixed(1))
      : null);

  return {
    raceEntryId,
    postPosition: item?.postPosition ?? null,
    status: item?.status ?? item?.raceEntryStatus ?? 'Confirmed',
    entryFeeStatus: item?.entryFeeStatus ?? null,
    horseName: item?.horse?.name ?? item?.horseName ?? 'Chưa có tên',
    horseBreed: item?.horse?.breed ?? item?.horseBreed ?? null,
    jockeyName: item?.jockey?.fullName ?? item?.jockeyName ?? 'Chưa có tên',
    selfDeclaredWeight,
    preRaceJockeyWeight,
    weightDifference: computedWeightDifference,
    thresholdKg: item?.thresholdKg ?? null,
    isWeightWarning: Boolean(item?.isWeightWarning),
    horseIdentityCheckStatus: item?.horseIdentityCheckStatus ?? item?.horseIdentityStatus ?? null,
    clinicalStatus: item?.clinicalStatus ?? null,
    unfitReason: item?.unfitReason ?? null,
    isEmergencyDisqualified: Boolean(item?.isEmergencyDisqualified),
    raceEntryStatus: item?.raceEntryStatus ?? item?.status ?? 'Confirmed',
  };
};

const extractArray = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return [];
};

// ─── Service functions ────────────────────────────────────────────────────────

export const getDoctorProfile = async (): Promise<DoctorProfessionalProfile> =>
  apiFetch<DoctorProfessionalProfile>('/doctors/profile');

export const updateDoctorProfile = async (
  payload: UpdateDoctorProfilePayload
): Promise<UpdateDoctorProfileResult> =>
  apiFetch<UpdateDoctorProfileResult>('/doctors/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

/**
 * GET /api/doctors/race-assignments/my
 * Lấy danh sách race mà Doctor đang được phân công.
 * Backend có thể trả thẳng array hoặc ApiResponse<array>.
 */
export const getMyDoctorRaceAssignments = async (): Promise<DoctorRaceAssignment[]> => {
  const res = await apiFetch<any>('/doctors/race-assignments/my');

  // Xử lý cả hai dạng response:
  // 1. Thẳng array
  if (Array.isArray(res)) return res;
  // 2. ApiResponse { success, message, data: array }
  if (Array.isArray(res?.data)) return res.data;
  // 3. ApiResponse { data: { items: array } } (paged)
  if (Array.isArray(res?.data?.items)) return res.data.items;

  // Không có dữ liệu — trả về mảng rỗng thay vì crash
  return [];
};

/**
 * GET /api/doctor/race-entries/races/{raceId}/entries
 * Lấy danh sách RaceEntry thật để Doctor thao tác trong Paddock.
 */
export const getDoctorRaceEntries = async (raceId: number): Promise<DoctorRaceEntry[]> => {
  const res = await apiFetch<any>(`/doctor/race-entries/races/${raceId}/entries`);
  return extractArray(res)
    .map(normalizeRaceEntry)
    .filter((item): item is DoctorRaceEntry => item !== null);
};

export const updatePreRaceWeight = async (
  raceEntryId: number,
  preRaceJockeyWeight: number
): Promise<PreRaceWeightResponse> => {
  return apiFetch<PreRaceWeightResponse>(`/doctor/race-entries/${raceEntryId}/pre-race-weight`, {
    method: 'PATCH',
    body: JSON.stringify({ preRaceJockeyWeight }),
  });
};

export const updateHorseIdentity = async (
  raceEntryId: number,
  horseIdentityCheckStatus: 'Matched' | 'Mismatch'
): Promise<HorseIdentityResponse> => {
  return apiFetch<HorseIdentityResponse>(`/doctor/race-entries/${raceEntryId}/horse-identity`, {
    method: 'PATCH',
    body: JSON.stringify({ horseIdentityCheckStatus }),
  });
};

export const updateClinicalCheck = async (
  raceEntryId: number,
  clinicalStatus: 'Fit' | 'Unfit',
  unfitReason: string | null
): Promise<ClinicalCheckResponse> => {
  return apiFetch<ClinicalCheckResponse>(`/doctor/race-entries/${raceEntryId}/clinical-check`, {
    method: 'PATCH',
    body: JSON.stringify({ clinicalStatus, unfitReason }),
  });
};
