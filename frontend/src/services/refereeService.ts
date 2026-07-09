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
