import { apiFetch } from './apiClient';
import type { Penalty, RaceViolation, UpdateViolationPayload } from '../types/protest.types';

export type { RaceViolation } from '../types/protest.types';

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
  jockeyId: number | null;
  raceId: number | null;
  pairingId: number | null;
  postPosition: number | null;
  status: string;
  raceEntryStatus: string | null;
  horseName: string;
  jockeyName: string;
  ownerName: string | null;
  selfDeclaredWeight?: number | null;
  preRaceJockeyWeight?: number | null;
  horseIdentityCheckStatus?: string | null;
  clinicalStatus?: string | null;
  isEmergencyDisqualified?: boolean;
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

export interface CreateViolationPayload {
  raceEntryId: number;
  violationCode: string;
  penalty: Penalty;
  placeBehindEntryId?: number | null;
  description: string;
}

export interface ViolationCodeOption {
  code: string;
  name: string;
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

const positiveId = (value: string | number, name: string): number => {
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${name} phải là số nguyên dương.`);
  return id;
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

  const rawJockeyId = item?.jockey?.jockeyId ?? item?.jockeyId;
  const jockeyId = Number(rawJockeyId);
  const normalized: RefereeRaceEntry = {
    raceEntryId,
    jockeyId: Number.isInteger(jockeyId) && jockeyId > 0 ? jockeyId : null,
    raceId: item?.raceId ?? null,
    pairingId: item?.pairingId ?? null,
    postPosition: item?.postPosition ?? null,
    status: item?.status ?? item?.raceEntryStatus ?? 'Unknown',
    raceEntryStatus: item?.raceEntryStatus ?? item?.status ?? null,
    horseName: item?.horse?.name ?? item?.horseName ?? 'Chưa có tên',
    jockeyName: item?.jockey?.fullName ?? item?.jockeyName ?? 'Chưa có kỵ sĩ',
    ownerName: item?.owner?.fullName ?? item?.ownerName ?? null,
    independenceCheckStatus: item?.independenceCheckStatus ?? null,
    independenceViolationReason: item?.independenceViolationReason ?? item?.violationReason ?? null,
    hasIndependenceWarning: Boolean(item?.hasIndependenceWarning ?? item?.hasWarning),
  };

  if ('selfDeclaredWeight' in item) normalized.selfDeclaredWeight = item.selfDeclaredWeight ?? null;
  if ('preRaceJockeyWeight' in item || 'preRaceWeight' in item) {
    normalized.preRaceJockeyWeight = item.preRaceJockeyWeight ?? item.preRaceWeight ?? null;
  }
  if ('horseIdentityCheckStatus' in item || 'horseIdentityStatus' in item) {
    normalized.horseIdentityCheckStatus =
      item.horseIdentityCheckStatus ?? item.horseIdentityStatus ?? null;
  }
  if ('clinicalStatus' in item) normalized.clinicalStatus = item.clinicalStatus ?? null;
  if ('isEmergencyDisqualified' in item) {
    normalized.isEmergencyDisqualified = Boolean(item.isEmergencyDisqualified);
  }

  return normalized;
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

export const getRefereeRaceEntries = async (
  raceId: number | string
): Promise<RefereeRaceEntry[]> => {
  const res = await apiFetch<any>(`/referee/race-entries/races/${raceId}/entries`);
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
  const id = positiveId(raceId, 'raceId');
  const res = await apiFetch<ApiResponse<RaceViolation[]> | RaceViolation[]>(
    `/races/${id}/violations`
  );
  return unwrapData(res);
};

export const getViolationCodes = async (): Promise<ViolationCodeOption[]> => {
  const res = await apiFetch<ApiResponse<ViolationCodeOption[]> | ViolationCodeOption[]>(
    '/violations/codes'
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

export const updateRaceViolation = async (
  raceId: string | number,
  violationId: string | number,
  payload: UpdateViolationPayload,
  onMessage?: (message: string) => void
): Promise<RaceViolation> => {
  const validRaceId = positiveId(raceId, 'raceId');
  const validViolationId = positiveId(violationId, 'violationId');
  const placeBehindEntryId = payload.placeBehindEntryId == null
    ? null
    : positiveId(payload.placeBehindEntryId, 'placeBehindEntryId');
  const res = await apiFetch<ApiResponse<RaceViolation>>(
    `/referees/races/${validRaceId}/violations/${validViolationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        violationCode: payload.violationCode,
        penalty: payload.penalty,
        placeBehindEntryId: payload.penalty === 'PlaceBehind' ? placeBehindEntryId : null,
        description: payload.description,
      }),
    }
  );
  if (!res.success || res.data === null) throw new Error(res.message || 'Không thể cập nhật vi phạm.');
  onMessage?.(res.message);
  return res.data;
};

export const deleteRaceViolation = async (
  raceId: string | number,
  violationId: string | number
): Promise<void> => {
  const validRaceId = positiveId(raceId, 'raceId');
  const validViolationId = positiveId(violationId, 'violationId');
  await apiFetch<void>(`/referees/races/${validRaceId}/violations/${validViolationId}`, {
    method: 'DELETE',
  });
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
