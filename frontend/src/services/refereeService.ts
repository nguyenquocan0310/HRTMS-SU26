import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface RefereeProfile {
  refereeId: number;
  username: string;
  fullName: string;
  email: string;
  certificationLevel: string;
  status: string;
  createdAt: string;
}

export interface UpdateRefereeProfilePayload {
  certificationLevel: string;
}

export interface RefereeRaceAssignment {
  raceId: number;
  raceNumber?: number | null;
  scheduledTime?: string | null;
  raceStatus?: string | null;
  roundId?: number | null;
  roundName?: string | null;
  tournamentId?: number | null;
  tournamentName?: string | null;
  refereeId?: number;
  refereeName?: string;
  refereeEmail?: string;
  certificationLevel?: string;
  role?: string;
  assignmentRole?: string | null;
  assignedAt: string;
}

export interface RefereeRaceEntry {
  raceEntryId: number;
  raceId: number | null;
  pairingId: number | null;
  postPosition: number | null;
  status: string;
  raceEntryStatus: string | null;
  horseName: string;
  jockeyName: string;
  ownerName: string | null;
  preRaceJockeyWeight: number | null;
  horseIdentityCheckStatus: string | null;
  clinicalStatus: string | null;
  independenceCheckStatus: string | null;
  independenceViolationReason: string | null;
  hasIndependenceWarning: boolean;
}

export interface IndependenceCheckResult {
  raceEntryId: number;
  raceId: number;
  refereeId: number;
  refereeName: string;
  horseName: string;
  jockeyId: number;
  jockeyName: string;
  independenceCheckStatus: string;
  hasWarning: boolean;
  violationReason: string | null;
  raceEntryStatus: string;
  message: string;
}

export interface StartingListEntry {
  raceEntryId: number;
  raceId: number;
  pairingId: number;
  horseName: string;
  jockeyName: string;
  ownerName: string;
  postPosition: number | null;
  status: string;
  preRaceJockeyWeight: number | null;
  horseIdentityCheckStatus: string | null;
  clinicalStatus: string | null;
  independenceCheckStatus: string | null;
  rejectionReason?: string | null;
}

export interface ConfirmStartingListResult {
  raceId: number;
  confirmedEntriesCount: number;
  rejectedEntriesCount: number;
  confirmedEntries: StartingListEntry[];
  rejectedEntries: StartingListEntry[];
  message: string;
}

export interface LiveRaceEntry {
  raceEntryId: number;
  postPosition: number | null;
  status: string;
  isWithdrawn: boolean;
  horseId: number | null;
  horseName: string;
  jockeyId: number | null;
  jockeyName: string;
  finishPosition: number | null;
  finishTime: number | null;
}

export interface RaceLiveStatus {
  raceId: number;
  status: string;
  scheduledTime: string | null;
  actualStartTime: string | null;
  raceDurationSeconds: number | null;
  entries: LiveRaceEntry[];
}

export interface RaceViolation {
  violationId?: number;
  raceEntryId: number | null;
  horseName?: string | null;
  jockeyName?: string | null;
  violationCode: string;
  penalty: string;
  placeBehindEntryId?: number | null;
  description?: string | null;
  recordedAt?: string | null;
  refereeName?: string | null;
}

export interface CreateViolationPayload {
  raceEntryId: number;
  violationCode: string;
  penalty: string;
  placeBehindEntryId?: number;
  description: string;
}

export interface FinishRaceResult {
  raceEntryId: number;
  finishPosition: number;
  finishTime: number;
}

export interface FinishRacePayload {
  notes: string;
  results: FinishRaceResult[];
}

const extractArray = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return [];
};

const unwrapData = <T>(res: ApiResponse<T> | T): T => {
  if (res && typeof res === 'object' && 'data' in res) {
    const apiRes = res as ApiResponse<T>;
    if (!apiRes.success || apiRes.data == null) {
      throw new Error(apiRes.message || 'API trả về dữ liệu không hợp lệ.');
    }
    return apiRes.data;
  }
  return res as T;
};

const normalizeAssignment = (item: any): RefereeRaceAssignment | null => {
  const raceId = Number(item?.raceId);
  if (!Number.isFinite(raceId)) return null;

  return {
    raceId,
    raceNumber: item?.raceNumber ?? null,
    scheduledTime: item?.scheduledTime ?? null,
    raceStatus: item?.raceStatus ?? item?.status ?? null,
    roundId: item?.roundId ?? null,
    roundName: item?.roundName ?? null,
    tournamentId: item?.tournamentId ?? null,
    tournamentName: item?.tournamentName ?? null,
    refereeId: item?.refereeId,
    refereeName: item?.refereeName,
    refereeEmail: item?.refereeEmail,
    certificationLevel: item?.certificationLevel,
    role: item?.role ?? item?.assignmentRole ?? null,
    assignmentRole: item?.assignmentRole ?? item?.role ?? null,
    assignedAt: item?.assignedAt ?? new Date().toISOString(),
  };
};

const normalizeRaceEntry = (item: any): RefereeRaceEntry | null => {
  const raceEntryId = Number(item?.raceEntryId ?? item?.id);
  if (!Number.isFinite(raceEntryId)) return null;

  return {
    raceEntryId,
    raceId: item?.raceId ?? null,
    pairingId: item?.pairingId ?? null,
    postPosition: item?.postPosition ?? null,
    status: item?.status ?? item?.raceEntryStatus ?? 'Unknown',
    raceEntryStatus: item?.raceEntryStatus ?? item?.status ?? null,
    horseName: item?.horse?.name ?? item?.horseName ?? 'Chưa có tên',
    jockeyName: item?.jockey?.fullName ?? item?.jockeyName ?? 'Chưa có kỵ sĩ',
    ownerName: item?.owner?.fullName ?? item?.ownerName ?? null,
    preRaceJockeyWeight: item?.preRaceJockeyWeight ?? null,
    horseIdentityCheckStatus: item?.horseIdentityCheckStatus ?? null,
    clinicalStatus: item?.clinicalStatus ?? null,
    independenceCheckStatus: item?.independenceCheckStatus ?? null,
    independenceViolationReason: item?.independenceViolationReason ?? item?.violationReason ?? null,
    hasIndependenceWarning: Boolean(item?.hasIndependenceWarning ?? item?.hasWarning),
  };
};

export const getRefereeProfile = async (): Promise<RefereeProfile> => {
  const res = await apiFetch<ApiResponse<RefereeProfile> | RefereeProfile>('/referees/profile');
  return unwrapData(res);
};

export const updateRefereeProfile = async (
  payload: UpdateRefereeProfilePayload
): Promise<RefereeProfile> => {
  const res = await apiFetch<ApiResponse<RefereeProfile> | RefereeProfile>('/referees/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return unwrapData(res);
};

export const getMyRefereeRaceAssignments = async (): Promise<RefereeRaceAssignment[]> => {
  const res = await apiFetch<any>('/referees/race-assignments/my');
  return extractArray(res)
    .map(normalizeAssignment)
    .filter((item): item is RefereeRaceAssignment => item !== null);
};

export const getRefereeRaceEntries = async (raceId: number): Promise<RefereeRaceEntry[]> => {
  const res = await apiFetch<any>(`/races/${raceId}/entries`);
  return extractArray(res)
    .map(normalizeRaceEntry)
    .filter((item): item is RefereeRaceEntry => item !== null);
};

export const checkJockeyIndependence = async (
  raceEntryId: number
): Promise<IndependenceCheckResult> => {
  return apiFetch<IndependenceCheckResult>(
    `/referee/race-entries/${raceEntryId}/independence-check`,
    { method: 'PATCH' }
  );
};

export const confirmStartingList = async (
  raceId: number
): Promise<ConfirmStartingListResult> => {
  return apiFetch<ConfirmStartingListResult>(
    `/referee/races/${raceId}/confirm-starting-list`,
    { method: 'POST' }
  );
};

export const getRaceLiveStatus = async (raceId: number): Promise<RaceLiveStatus> => {
  const res = await apiFetch<ApiResponse<RaceLiveStatus> | RaceLiveStatus>(
    `/races/${raceId}/live-status`
  );
  return unwrapData(res);
};

export const getRaceViolations = async (raceId: number): Promise<RaceViolation[]> => {
  const res = await apiFetch<ApiResponse<RaceViolation[]> | RaceViolation[]>(
    `/races/${raceId}/violations`
  );
  return unwrapData(res);
};

export const startRace = async (raceId: number): Promise<Partial<RaceLiveStatus>> => {
  const res = await apiFetch<ApiResponse<Partial<RaceLiveStatus>> | Partial<RaceLiveStatus>>(
    `/referees/races/${raceId}/start`,
    { method: 'POST' }
  );
  return unwrapData(res);
};

export const createRaceViolation = async (
  raceId: number,
  payload: CreateViolationPayload
): Promise<RaceViolation> => {
  const res = await apiFetch<ApiResponse<RaceViolation> | RaceViolation>(
    `/referees/races/${raceId}/violations`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
  return unwrapData(res);
};

export const finishRace = async (
  raceId: number,
  payload: FinishRacePayload
): Promise<Partial<RaceLiveStatus>> => {
  const res = await apiFetch<ApiResponse<Partial<RaceLiveStatus>> | Partial<RaceLiveStatus>>(
    `/referees/races/${raceId}/finish`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
  return unwrapData(res);
};
