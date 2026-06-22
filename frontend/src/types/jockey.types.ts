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
  bloodType: string;
  healthStatus: string;
  status: 'Active' | 'Suspended' | 'Retired';
  createdAt: string;
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
  status: 'Pending' | 'Accepted' | 'Declined';
  invitedAt: string;
  respondedAt?: string;
  requestMessage?: string;
}

/**
 * Represents a jockey's race entry (confirmation for a race)
 */
export interface JockeyRaceEntry {
  entryID: string;
  raceID: string;
  horseName: string;
  ownerName: string;
  scheduledTime: string;
  distanceM: number;
  purse: number;
  gateNumber?: number;
  status: 'PendingConf' | 'Confirmed' | 'Cancelled' | 'Disqualified';
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
