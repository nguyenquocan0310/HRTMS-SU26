export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface Protest {
  protestId: number;
  raceId: number;
  submittedByUserId: number;
  accusedRaceEntryId: number;
  violationId: number | null;
  description: string;
  status: string;
  refereeDecision: string | null;
  penaltyApplied: string | null;
  submittedAt: string;
  resolvedAt: string | null;
}

export interface SubmitProtestPayload {
  raceId: number;
  accusedRaceEntryId: number;
  violationId?: number | null;
  description: string;
}

export type ProtestDecision = 'Approved' | 'Rejected';

export type Penalty = 'Disqualified' | 'PlaceBehind' | 'Warning' | 'Scratch';

export interface ProtestRulingPayload {
  decision: ProtestDecision;
  penalty?: Penalty | null;
  placeBehindEntryId?: number | null;
  notes: string;
}

export interface RankedRaceEntry {
  raceEntryId: number;
  finishPosition: number | null;
  status: string;
}

export interface ProtestRulingResult {
  protest: Protest;
  rankings: RankedRaceEntry[];
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

export interface UpdateViolationPayload {
  violationCode: string;
  penalty: Penalty;
  placeBehindEntryId?: number | null;
  description: string;
}
