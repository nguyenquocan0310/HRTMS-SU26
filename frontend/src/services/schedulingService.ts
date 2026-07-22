import { apiFetch } from './apiClient';

export interface ScheduledEntry { raceEntryId: number; pairingId?: number; postPosition: number | null; status: string; entryFeeStatus?: string; horseId: number; horseName: string; jockeyId: number; jockeyName: string; ownerName?: string; }
export interface RaceSchedule { raceId: number; roundId: number; raceNumber: number; scheduledTime: string; status: string; isPostPositionDrawn: boolean; venueName?: string | null; venueCity?: string | null; venueTrackType?: string | null; laneCount?: number | null; trackLengthMeters?: number | null; raceCapacity?: number | null; entries: ScheduledEntry[]; }
export interface AllocationEntry { raceEntryId: number; pairingId: number; horseId: number; horseName: string; jockeyId: number; jockeyName: string; }
export interface SelectedPairing { position: number; pairingId: number; horseId: number; horseName: string; jockeyId: number; jockeyName: string; feeVerifiedAt: string | null; }
export interface WaitlistEntry { position: number; pairingId: number; horseId: number; horseName: string; feeVerifiedAt: string | null; }
export interface AllocationRace { raceId: number; raceNumber: number; scheduledTime: string; entryCount: number; entries: AllocationEntry[]; }
export interface AutoAllocateResult { roundId: number; tournamentId: number; isPreview: boolean; assignmentIsFinal: boolean; selectedPool: SelectedPairing[]; warnings: string[]; poolSize: number; capacityPerRace: number; raceCount: number; totalCapacity: number; allocatedCount: number; waitlistedCount: number; races: AllocationRace[]; waitlist: WaitlistEntry[]; }
export interface DrawAssignment { raceEntryId: number; pairingId: number; horseId: number; horseName: string; postPosition: number; }
export interface DrawResult { raceId: number; isPostPositionDrawn: boolean; totalEntries: number; assignments: DrawAssignment[]; }
export interface FinalizeResult { roundId: number; allocation: AutoAllocateResult; draws: DrawResult[]; skippedDraws: Array<{ raceId: number; raceNumber: number; reason: string }>; }

interface ApiEnvelope<T> { success: boolean; message?: string; data: T | null; }
export const getRaceSchedule = (raceId: number) => apiFetch<ApiEnvelope<RaceSchedule>>(`/races/${raceId}/entries`).then((response) => {
  if (!response.success || !response.data) throw new Error(response.message ?? 'Không tải được danh sách xuất phát.');
  return response.data;
});
export const previewAutoAllocate = (roundId: number) => apiFetch<AutoAllocateResult>(`/admin/rounds/${roundId}/auto-allocate/preview`, { method: 'POST' });
export const autoAllocate = (roundId: number) => apiFetch<AutoAllocateResult>(`/admin/rounds/${roundId}/auto-allocate`, { method: 'POST' });
export const getRoundWaitlist = (roundId: number) => apiFetch<WaitlistEntry[]>(`/admin/rounds/${roundId}/waitlist`);
export const moveRaceEntry = (entryId: number, targetRaceId: number) => apiFetch<ScheduledEntry>(`/admin/race-entries/${entryId}/move`, { method: 'PUT', body: JSON.stringify({ targetRaceId }) });
export const drawPostPositions = (raceId: number) => apiFetch<DrawResult>(`/admin/races/${raceId}/draw`, { method: 'POST' });
export const finalizeRound = (roundId: number) => apiFetch<FinalizeResult>(`/admin/rounds/${roundId}/finalize`, { method: 'POST' });
