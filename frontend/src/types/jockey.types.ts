/**
 * Horse Racing Management System - Jockey Types
 * This file contains TypeScript interfaces for managing jockey profiles, race invitations, race entries, and results.
 */

/**
 * Represents a jockey's profile information
 */
export interface JockeyProfile {
  jockeyId: number;
  username: string;
  fullName: string;
  email: string;
  licenseCertificate: string;
  experienceYears: number;
  selfDeclaredWeight: number;
  bloodType: string | null;
  healthStatus: string | null;
  status: 'Active' | 'Suspended' | 'Retired';
  createdAt: string;
}

export interface JockeyCareerStats {
  jockeyId: number;
  fullName: string;
  totalRaces: number;
  wins: number;
  podiums: number;
  winRate: number | null;
  podiumRate: number | null;
  averageFinishPosition: number | null;
  totalPoints: number;
  totalEarnings: number;
}

/**
 * Represents a race invitation sent to a jockey
 */
export interface RaceInvitation {
  invitationID: string;
  raceID?: string;
  ownerID: string;
  ownerName: string;
  horseName: string;
  breedCode: string;
  raceScheduledTime?: string;
  status: 'Pending' | 'Accepted' | 'Confirmed' | 'Declined' | 'Cancelled';
  invitedAt: string;
  respondedAt?: string;
  requestMessage?: string;
}

export interface JockeyRaceEntry {
  raceEntryId: number;
  raceId: number;
  pairingId: number;
  tournamentId: number;
  tournamentName: string;
  roundId: number;
  roundName: string;
  raceNumber: number;
  scheduledTime: string;
  raceStatus: string;
  entryStatus: string;
  postPosition: number | null;
  horseId: number;
  horseName: string;
  ownerId: number;
  ownerName: string;
  pairingStatus: string;
  preRaceJockeyWeight: number | null;
  horseIdentityCheckStatus: string | null;
  clinicalStatus: string | null;
  postRaceJockeyWeight: number | null;
  finishPosition: number | null;
  finishTime: string | null;
  pointsAwarded: number | null;
  earningsAwarded: number | null;
  entryFeeStatus: string;
  isWithdrawn: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a jockey's race result
 */
export interface JockeyRaceResult {
  resultID: string;
  raceID: string;
  horseName: string;
  finishPosition: number;
  timeSeconds: number;
  prizeAmount: number;
  pointsEarned: number;
  isDisqualified: boolean;
  raceDate: string;
}
