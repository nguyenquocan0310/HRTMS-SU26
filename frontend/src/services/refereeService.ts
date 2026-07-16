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

export interface UpdateRefereeProfileResult {
  refereeId: number;
  status: string;
  message: string;
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
  isWithdrawn: boolean;
  raceEntryStatus: string | null;
  horseName: string;
  jockeyName: string;
  ownerName: string | null;
  preRaceJockeyWeight: number | null;
  horseIdentityCheckStatus: string | null;
  clinicalStatus: string | null;
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
  loggedAt?: string | null;
  refereeName?: string | null;
}

export interface CreateViolationPayload {
  raceEntryId: number;
  violationCode: string;
  penalty: string;
  placeBehindEntryId?: number;
  description: string;
}

export type UpdateViolationPayload = Omit<CreateViolationPayload, 'raceEntryId'>;

export interface ViolationCodeOption {
  code: string;
  name: string;
  description: string;
}

export interface FinishRaceResult {
  raceEntryId: number;
  finishPosition: number;
  finishTime?: number;
}

export interface FinishRacePayload {
  notes: string;
  results: FinishRaceResult[];
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const numberOrUndefined = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const stringOrNull = (value: unknown): string | null => typeof value === 'string' ? value : null;
const stringOrUndefined = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;

const extractArray = (res: unknown): unknown[] => {
  if (Array.isArray(res)) return res;
  const root = asRecord(res);
  if (Array.isArray(root.data)) return root.data;
  const data = asRecord(root.data);
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.entries)) return data.entries;
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

const normalizeAssignment = (value: unknown): RefereeRaceAssignment | null => {
  const item = asRecord(value);
  const raceId = Number(item.raceId);
  if (!Number.isFinite(raceId)) return null;

  return {
    raceId,
    raceNumber: numberOrNull(item.raceNumber),
    scheduledTime: stringOrNull(item.scheduledTime),
    raceStatus: stringOrNull(item.raceStatus ?? item.status),
    roundId: numberOrNull(item.roundId),
    roundName: stringOrNull(item.roundName),
    tournamentId: numberOrNull(item.tournamentId),
    tournamentName: stringOrNull(item.tournamentName),
    refereeId: numberOrUndefined(item.refereeId),
    refereeName: stringOrUndefined(item.refereeName),
    refereeEmail: stringOrUndefined(item.refereeEmail),
    certificationLevel: stringOrUndefined(item.certificationLevel),
    role: stringOrUndefined(item.role ?? item.assignmentRole),
    assignmentRole: stringOrNull(item.assignmentRole ?? item.role),
    assignedAt: typeof item.assignedAt === 'string' ? item.assignedAt : '',
  };
};

const normalizeRaceEntry = (value: unknown): RefereeRaceEntry | null => {
  const item = asRecord(value);
  const horse = asRecord(item.horse);
  const jockey = asRecord(item.jockey);
  const owner = asRecord(item.owner);
  const raceEntryId = Number(item.raceEntryId ?? item.id);
  if (!Number.isFinite(raceEntryId)) return null;

  return {
    raceEntryId,
    raceId: numberOrNull(item.raceId),
    pairingId: numberOrNull(item.pairingId),
    postPosition: numberOrNull(item.postPosition),
    status: stringOrNull(item.status ?? item.raceEntryStatus) ?? 'Unknown',
    isWithdrawn: item.isWithdrawn === true,
    raceEntryStatus: stringOrNull(item.raceEntryStatus ?? item.status),
    horseName: String(horse.name ?? item.horseName ?? 'Chưa có tên'),
    jockeyName: String(jockey.fullName ?? item.jockeyName ?? 'Chưa có kỵ sĩ'),
    ownerName: owner.fullName != null ? String(owner.fullName) : item.ownerName != null ? String(item.ownerName) : null,
    preRaceJockeyWeight: numberOrNull(item.preRaceJockeyWeight),
    horseIdentityCheckStatus: stringOrNull(item.horseIdentityCheckStatus),
    clinicalStatus: stringOrNull(item.clinicalStatus),
  };
};

export const getRefereeProfile = async (): Promise<RefereeProfile> => {
  const res = await apiFetch<ApiResponse<RefereeProfile> | RefereeProfile>('/referees/profile');
  return unwrapData(res);
};

export const updateRefereeProfile = async (
  payload: UpdateRefereeProfilePayload
): Promise<UpdateRefereeProfileResult> => {
  const res = await apiFetch<ApiResponse<UpdateRefereeProfileResult> | UpdateRefereeProfileResult>('/referees/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return unwrapData(res);
};

export const getMyRefereeRaceAssignments = async (): Promise<RefereeRaceAssignment[]> => {
  const res = await apiFetch<unknown>('/referees/race-assignments/my');
  return extractArray(res)
    .map(normalizeAssignment)
    .filter((item): item is RefereeRaceAssignment => item !== null);
};

export const getRefereeRaceEntries = async (raceId: number): Promise<RefereeRaceEntry[]> => {
  const res = await apiFetch<unknown>(`/races/${raceId}/entries`);
  return extractArray(res)
    .map(normalizeRaceEntry)
    .filter((item): item is RefereeRaceEntry => item !== null);
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

export const getViolationCodes = async (): Promise<ViolationCodeOption[]> => {
  const res = await apiFetch<ApiResponse<ViolationCodeOption[]> | ViolationCodeOption[]>('/violations/codes');
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
  raceId: number,
  violationId: number,
  payload: UpdateViolationPayload
): Promise<RaceViolation> => {
  const res = await apiFetch<ApiResponse<RaceViolation> | RaceViolation>(
    `/referees/races/${raceId}/violations/${violationId}`,
    { method: 'PATCH', body: JSON.stringify(payload) }
  );
  return unwrapData(res);
};

export const deleteRaceViolation = async (raceId: number, violationId: number): Promise<void> => {
  await apiFetch<void>(`/referees/races/${raceId}/violations/${violationId}`, { method: 'DELETE' });
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
