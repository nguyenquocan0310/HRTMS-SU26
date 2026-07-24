import { apiFetch } from './apiClient';
import { calculateWeightDifference, parseWeightValue } from '../utils/paddockWeight';

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
  raceStatus: string | null;
  entryFeeStatus: string | null;
  horseName: string;
  horseBreed: string | null;
  jockeyName: string;
  selfDeclaredWeight: number | null;
  preRaceJockeyWeight: number | null;
  postRaceJockeyWeight: number | null;
  postRaceWeightDifference: number | null;
  postRaceWeightFlagged: boolean;
  postRaceThresholdKg: number | null;
  weightDifference: number | null;
  thresholdKg: number | null;
  isWeightWarning: boolean;
  horseIdentityCheckStatus: string | null;
  clinicalStatus: string | null;
  unfitReason: string | null;
  postRaceClinicalStatus: string | null;
  postRaceUnfitReason: string | null;
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
  isEmergencyDisqualified?: boolean;
  raceEntryStatus?: string | null;
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

export interface PostRaceWeightResponse {
  raceEntryId: number;
  preRaceJockeyWeight: number;
  postRaceJockeyWeight: number;
  weightDifference: number;
  thresholdKg: number;
  isWeightFlagged: boolean;
  message: string;
}

export interface PostRaceClinicalCheckResponse {
  raceEntryId: number;
  raceId: number;
  doctorId: number;
  doctorName: string;
  horseName: string;
  jockeyName: string;
  postRaceClinicalStatus: 'Fit' | 'Unfit';
  unfitReason: string | null;
  isEmergencyDisqualified: boolean;
  raceEntryStatus: string;
  message: string;
}

export interface RaceEntryHealthProfile {
  raceEntryId: number;
  raceId: number;
  postPosition: number | null;
  jockeyName: string;
  licenseCertificate: string;
  experienceYears: number;
  bloodType: string | null;
  healthStatus: string | null;
  selfDeclaredWeight: number;
  preRaceWeightThresholdKg: number;
  preRaceJockeyWeight: number | null;
  preRaceWeightDifference: number | null;
  isPreRaceWeightWarning: boolean | null;
  postRaceJockeyWeight: number | null;
  postRaceWeightFlagged: boolean;
  horseName: string;
  breed: string;
  color: string;
  gender: string;
  birthYear: number;
  identifyingMarks: string;
  vaccinationRecordRef: string;
  dopingTestDate: string | null;
  dopingTestResult: string;
  horseIdentityCheckStatus: string | null;
  clinicalStatus: string | null;
  unfitReason: string | null;
  postRaceClinicalStatus: string | null;
  postRaceClinicalCheckedByDoctorId: number | null;
  postRaceClinicalCheckedByDoctorName: string | null;
  postRaceClinicalCheckedAt: string | null;
  postRaceUnfitReason: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const nullableNumber = (value: unknown): number | null => parseWeightValue(value);

const nullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const normalizeRaceEntry = (value: unknown): DoctorRaceEntry | null => {
  if (!isRecord(value)) return null;
  const item = value;
  const horse = isRecord(item.horse) ? item.horse : null;
  const jockey = isRecord(item.jockey) ? item.jockey : null;
  const rawId = item.raceEntryId ?? item.id;
  const raceEntryId = Number(rawId);
  if (!Number.isFinite(raceEntryId)) return null;
  const selfDeclaredWeight = nullableNumber(item.selfDeclaredWeight ?? jockey?.selfDeclaredWeight);
  const preRaceJockeyWeight = nullableNumber(item.preRaceJockeyWeight ?? item.preRaceWeight);
  const computedWeightDifference = calculateWeightDifference(
    preRaceJockeyWeight,
    selfDeclaredWeight
  );
  const status = nullableString(item.status ?? item.raceEntryStatus) ?? 'Confirmed';

  return {
    raceEntryId,
    postPosition: nullableNumber(item.postPosition),
    status,
    raceStatus: nullableString(item.raceStatus),
    entryFeeStatus: nullableString(item.entryFeeStatus),
    horseName: nullableString(horse?.name ?? item.horseName) ?? 'Chưa có tên',
    horseBreed: nullableString(horse?.breed ?? item.horseBreed),
    jockeyName: nullableString(jockey?.fullName ?? item.jockeyName) ?? 'Chưa có tên',
    selfDeclaredWeight,
    preRaceJockeyWeight,
    postRaceJockeyWeight: nullableNumber(item.postRaceJockeyWeight ?? item.postRaceWeight),
    postRaceWeightDifference: nullableNumber(item.postRaceWeightDifference),
    postRaceWeightFlagged: Boolean(item.postRaceWeightFlagged ?? item.isWeightFlagged),
    postRaceThresholdKg: nullableNumber(
      item.postRaceThresholdKg ?? item.postRaceWeightDiffThresholdKg
    ),
    weightDifference: computedWeightDifference,
    thresholdKg: nullableNumber(item.thresholdKg),
    isWeightWarning: Boolean(item.isWeightWarning),
    horseIdentityCheckStatus: nullableString(item.horseIdentityCheckStatus ?? item.horseIdentityStatus),
    clinicalStatus: nullableString(item.clinicalStatus),
    unfitReason: nullableString(item.unfitReason),
    postRaceClinicalStatus: nullableString(item.postRaceClinicalStatus),
    postRaceUnfitReason: nullableString(item.postRaceUnfitReason),
    isEmergencyDisqualified: Boolean(item.isEmergencyDisqualified),
    raceEntryStatus: nullableString(item.raceEntryStatus) ?? status,
  };
};

const extractArray = (res: unknown): unknown[] => {
  if (Array.isArray(res)) return res;
  if (!isRecord(res)) return [];
  if (Array.isArray(res.data)) return res.data;
  if (isRecord(res.data) && Array.isArray(res.data.items)) return res.data.items;
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
  const res = await apiFetch<unknown>('/doctors/race-assignments/my');
  return extractArray(res) as DoctorRaceAssignment[];
};

/**
 * GET /api/doctor/race-entries/races/{raceId}/entries
 * Lấy danh sách RaceEntry thật để Doctor thao tác trong Paddock.
 */
export const getDoctorRaceEntries = async (raceId: number): Promise<DoctorRaceEntry[]> => {
  const res = await apiFetch<unknown>(`/doctor/race-entries/races/${raceId}/entries`);
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

export const updatePostRaceWeight = async (
  raceEntryId: number,
  postRaceJockeyWeight: number
): Promise<PostRaceWeightResponse> =>
  apiFetch<PostRaceWeightResponse>(`/doctor/race-entries/${raceEntryId}/post-race-weight`, {
    method: 'PATCH',
    body: JSON.stringify({ postRaceJockeyWeight }),
  });

export const updatePostRaceClinicalCheck = async (
  raceEntryId: number,
  postRaceClinicalStatus: 'Fit' | 'Unfit',
  unfitReason: string | null
): Promise<PostRaceClinicalCheckResponse> =>
  apiFetch<PostRaceClinicalCheckResponse>(
    `/doctor/race-entries/${raceEntryId}/post-race-clinical-check`,
    {
      method: 'PATCH',
      body: JSON.stringify({ postRaceClinicalStatus, unfitReason }),
    }
  );

export const getRaceEntryHealthProfile = async (
  raceEntryId: number
): Promise<RaceEntryHealthProfile> =>
  apiFetch<RaceEntryHealthProfile>(`/doctor/race-entries/${raceEntryId}/health-profile`);
