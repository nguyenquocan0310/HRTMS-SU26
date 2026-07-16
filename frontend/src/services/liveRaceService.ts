import { apiFetch } from './apiClient';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T | null;
}

export interface LiveRaceEntry {
  raceEntryId: number;
  postPosition: number | null;
  status: string;
  isWithdrawn: boolean;
  horseId: number;
  horseName: string;
  jockeyId: number;
  jockeyName: string;
  finishPosition: number | null;
  finishTime: number | null;
}

export interface LiveRaceStatus {
  raceId: number;
  status: string;
  scheduledTime: string;
  actualStartTime: string | null;
  raceDurationSeconds: number;
  entries: LiveRaceEntry[];
}

export interface RaceViolation {
  violationId: number;
  raceEntryId: number;
  horseName: string;
  violationCode: string;
  penalty: string;
  placeBehindEntryId: number | null;
  description: string;
  loggedAt: string;
}

const unwrap = <T>(response: ApiResponse<T>, fallback: string): T => {
  if (!response.success || response.data == null) {
    throw new Error(response.message || fallback);
  }
  return response.data;
};

export const getLiveRaceStatus = async (raceId: number): Promise<LiveRaceStatus> =>
  unwrap(
    await apiFetch<ApiResponse<LiveRaceStatus>>(`/races/${raceId}/live-status`),
    'Không tải được trạng thái cuộc đua.'
  );

export const getRaceViolations = async (raceId: number): Promise<RaceViolation[]> =>
  unwrap(
    await apiFetch<ApiResponse<RaceViolation[]>>(`/races/${raceId}/violations`),
    'Không tải được danh sách vi phạm.'
  );
