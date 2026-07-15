import { apiFetch } from './apiClient';
import type {
  ApiResponse,
  Protest,
  ProtestRulingPayload,
  ProtestRulingResult,
  SubmitProtestPayload,
} from '../types/protest.types';

type MessageHandler = (message: string) => void;

export interface ProtestRaceEntry {
  raceEntryId: number;
  postPosition: number | null;
  horseName: string;
  jockeyName: string;
  ownerName: string;
}

interface RaceEntriesEnvelope {
  entries: Array<{
    raceEntryId: number;
    postPosition: number | null;
    horseName: string;
    jockeyName: string;
    ownerName: string;
  }>;
}

const positiveId = (value: string | number, name: string): number => {
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${name} phải là số nguyên dương.`);
  }
  return id;
};

const unwrap = <T>(response: ApiResponse<T>, onMessage?: MessageHandler): T => {
  if (!response.success || response.data === null) {
    throw new Error(response.message || 'API trả về dữ liệu không hợp lệ.');
  }
  onMessage?.(response.message);
  return response.data;
};

export const submitProtest = async (
  payload: SubmitProtestPayload,
  onMessage?: MessageHandler
): Promise<Protest> => {
  const raceId = positiveId(payload.raceId, 'raceId');
  const accusedRaceEntryId = positiveId(payload.accusedRaceEntryId, 'accusedRaceEntryId');
  const violationId = payload.violationId == null
    ? null
    : positiveId(payload.violationId, 'violationId');

  const response = await apiFetch<ApiResponse<Protest>>('/protests', {
    method: 'POST',
    body: JSON.stringify({
      raceId,
      accusedRaceEntryId,
      violationId,
      description: payload.description,
    }),
  });
  return unwrap(response, onMessage);
};

export const getProtestsByRace = async (
  raceId: string | number,
  onMessage?: MessageHandler
): Promise<Protest[]> => {
  const id = positiveId(raceId, 'raceId');
  const response = await apiFetch<ApiResponse<Protest[]>>(`/protests/races/${id}`);
  return unwrap(response, onMessage);
};

export const getRaceEntriesForProtest = async (
  raceId: string | number,
): Promise<ProtestRaceEntry[]> => {
  const id = positiveId(raceId, 'raceId');
  const response = await apiFetch<ApiResponse<RaceEntriesEnvelope>>(`/races/${id}/entries`);
  const data = unwrap(response);
  return (data.entries ?? []).map((entry) => ({
    raceEntryId: entry.raceEntryId,
    postPosition: entry.postPosition,
    horseName: entry.horseName,
    jockeyName: entry.jockeyName,
    ownerName: entry.ownerName,
  }));
};

export const ruleProtest = async (
  protestId: string | number,
  payload: ProtestRulingPayload,
  onMessage?: MessageHandler
): Promise<ProtestRulingResult> => {
  const id = positiveId(protestId, 'protestId');
  const placeBehindEntryId = payload.placeBehindEntryId == null
    ? null
    : positiveId(payload.placeBehindEntryId, 'placeBehindEntryId');
  const response = await apiFetch<ApiResponse<ProtestRulingResult>>(`/protests/${id}/ruling`, {
    method: 'PATCH',
    body: JSON.stringify({
      decision: payload.decision,
      penalty: payload.decision === 'Rejected' ? null : payload.penalty ?? null,
      placeBehindEntryId: payload.decision === 'Rejected' ? null : placeBehindEntryId,
      notes: payload.notes,
    }),
  });
  return unwrap(response, onMessage);
};
