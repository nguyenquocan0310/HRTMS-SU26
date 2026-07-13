import { apiFetch } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  postRaceJockeyWeight: number | null;
  postRaceWeightDifference: number | null;
  postRaceWeightThresholdKg: number | null;
  isPostRaceWeightFlagged: boolean;
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

export interface PostRaceWeightResponse {
  raceEntryId: number;
  preRaceJockeyWeight?: number | null;
  postRaceJockeyWeight?: number | null;
  weightDifference?: number | null;
  thresholdKg?: number | null;
  isWeightFlagged?: boolean;
  message?: string;
}

export interface DoctorRaceEntryHealthProfile extends Partial<Omit<DoctorRaceEntry, 'raceEntryId'>> {
  raceEntryId: number;
  raceId?: number;
  postPosition?: number | null;
  jockeyId?: number;
  jockeyName?: string;
  licenseCertificate?: string | null;
  experienceYears?: number | null;
  bloodType?: string | null;
  healthStatus?: string | null;
  horseId?: number;
  horseName?: string;
  breed?: string | null;
  color?: string | null;
  gender?: string | null;
  birthYear?: number | null;
  identifyingMarks?: string | null;
  vaccinationRecordRef?: string | null;
  dopingTestDate?: string | null;
  dopingTestResult?: string | null;
  preRaceWeightThresholdKg?: number | null;
  preRaceWeightByDoctorId?: number | null;
  preRaceWeightByDoctorName?: string | null;
  preRaceWeightDifference?: number | null;
  isPreRaceWeightWarning?: boolean | null;
  postRaceWeightByDoctorId?: number | null;
  postRaceWeightByDoctorName?: string | null;
  horseIdentityCheckedByDoctorId?: number | null;
  horseIdentityCheckedByDoctorName?: string | null;
  horseIdentityCheckedAt?: string | null;
  clinicalCheckedByDoctorId?: number | null;
  clinicalCheckedByDoctorName?: string | null;
  clinicalCheckedAt?: string | null;
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
    postRaceJockeyWeight: item?.postRaceJockeyWeight ?? null,
    postRaceWeightDifference: item?.postRaceWeightDifference ?? null,
    postRaceWeightThresholdKg: item?.postRaceWeightThresholdKg ?? null,
    isPostRaceWeightFlagged: Boolean(
      item?.isPostRaceWeightFlagged ?? item?.postRaceWeightFlagged
    ),
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

/**
 * GET /api/doctor/race-entries/{raceEntryId}/health-profile
 * Lấy trạng thái y tế mới nhất của một entry sau khi Doctor cập nhật.
 */
export const getDoctorRaceEntryHealthProfile = async (
  raceEntryId: number | string
): Promise<DoctorRaceEntryHealthProfile> => {
  const res = await apiFetch<any>(`/doctor/race-entries/${raceEntryId}/health-profile`);
  const payload = res && typeof res === 'object' && 'data' in res ? res.data : res;

  if (res?.success === false || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(res?.message || 'Không tải được hồ sơ sức khỏe race entry.');
  }

  const resolvedRaceEntryId = Number(payload.raceEntryId ?? raceEntryId);
  if (!Number.isFinite(resolvedRaceEntryId)) {
    throw new Error('Hồ sơ sức khỏe không có raceEntryId hợp lệ.');
  }

  const selfDeclaredWeight = payload.selfDeclaredWeight ?? null;
  const preRaceJockeyWeight = payload.preRaceJockeyWeight ?? payload.preRaceWeight ?? null;
  const weightDifference =
    payload.weightDifference ??
    payload.preRaceWeightDifference ??
    (typeof preRaceJockeyWeight === 'number' && typeof selfDeclaredWeight === 'number'
      ? Number((preRaceJockeyWeight - selfDeclaredWeight).toFixed(1))
      : null);

  const profile: DoctorRaceEntryHealthProfile = {
    raceEntryId: resolvedRaceEntryId,
    raceId: payload.raceId,
    jockeyId: payload.jockeyId,
    jockeyName: payload.jockeyName,
    licenseCertificate: payload.licenseCertificate ?? null,
    experienceYears: payload.experienceYears ?? null,
    bloodType: payload.bloodType ?? null,
    healthStatus: payload.healthStatus ?? null,
    horseId: payload.horseId,
    horseName: payload.horseName,
    horseBreed: payload.breed ?? payload.horseBreed ?? null,
    breed: payload.breed ?? payload.horseBreed ?? null,
    color: payload.color ?? null,
    gender: payload.gender ?? null,
    birthYear: payload.birthYear ?? null,
    identifyingMarks: payload.identifyingMarks ?? null,
    vaccinationRecordRef: payload.vaccinationRecordRef ?? null,
    dopingTestDate: payload.dopingTestDate ?? null,
    dopingTestResult: payload.dopingTestResult ?? null,
    selfDeclaredWeight,
    preRaceJockeyWeight,
    weightDifference,
    thresholdKg: payload.thresholdKg ?? payload.preRaceWeightThresholdKg ?? null,
    preRaceWeightThresholdKg: payload.preRaceWeightThresholdKg ?? null,
    preRaceWeightByDoctorId: payload.preRaceWeightByDoctorId ?? null,
    preRaceWeightByDoctorName: payload.preRaceWeightByDoctorName ?? null,
    preRaceWeightDifference: payload.preRaceWeightDifference ?? null,
    isPreRaceWeightWarning: payload.isPreRaceWeightWarning ?? null,
    postRaceJockeyWeight: payload.postRaceJockeyWeight ?? null,
    postRaceWeightDifference:
      payload.postRaceWeightDifference ??
      (typeof payload.postRaceJockeyWeight === 'number' &&
      typeof preRaceJockeyWeight === 'number'
        ? Number((preRaceJockeyWeight - payload.postRaceJockeyWeight).toFixed(1))
        : null),
    postRaceWeightThresholdKg: payload.postRaceWeightThresholdKg ?? null,
    isPostRaceWeightFlagged: Boolean(
      payload.isPostRaceWeightFlagged ?? payload.postRaceWeightFlagged
    ),
    postRaceWeightByDoctorId: payload.postRaceWeightByDoctorId ?? null,
    postRaceWeightByDoctorName: payload.postRaceWeightByDoctorName ?? null,
    horseIdentityCheckedByDoctorId: payload.horseIdentityCheckedByDoctorId ?? null,
    horseIdentityCheckedByDoctorName: payload.horseIdentityCheckedByDoctorName ?? null,
    horseIdentityCheckedAt: payload.horseIdentityCheckedAt ?? null,
    clinicalCheckedByDoctorId: payload.clinicalCheckedByDoctorId ?? null,
    clinicalCheckedByDoctorName: payload.clinicalCheckedByDoctorName ?? null,
    clinicalCheckedAt: payload.clinicalCheckedAt ?? null,
  };

  if ('isWeightWarning' in payload || 'isPreRaceWeightWarning' in payload) {
    profile.isWeightWarning = Boolean(
      payload.isWeightWarning ?? payload.isPreRaceWeightWarning
    );
  }
  if ('postPosition' in payload) profile.postPosition = payload.postPosition ?? null;
  if ('horseIdentityCheckStatus' in payload || 'horseIdentityStatus' in payload) {
    profile.horseIdentityCheckStatus =
      payload.horseIdentityCheckStatus ?? payload.horseIdentityStatus ?? null;
  }
  if ('clinicalStatus' in payload) profile.clinicalStatus = payload.clinicalStatus ?? null;
  if ('unfitReason' in payload) profile.unfitReason = payload.unfitReason ?? null;

  return profile;
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
): Promise<PostRaceWeightResponse> => {
  return apiFetch<PostRaceWeightResponse>(`/doctor/race-entries/${raceEntryId}/post-race-weight`, {
    method: 'PATCH',
    body: JSON.stringify({ postRaceJockeyWeight }),
  });
};
