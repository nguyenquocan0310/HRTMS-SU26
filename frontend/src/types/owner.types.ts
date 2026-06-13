/**
 * Horse Racing Management System - Owner Types
 * This file contains TypeScript interfaces for managing horses, race entries, jockey invitations, and breeds.
 */

/**
 * Represents a horse in the racing management system
 */
export interface Horse {
  horseID: string;
  ownerID: string;
  breedCode: string;
  name: string;
  birthYear: number;
  gender: 'Colt' | 'Filly' | 'Stallion' | 'Mare';
  color: string;
  vaccinationRecordRef?: string;
  dopingTestDate?: Date;
  dopingTestResult: 'Clean' | 'Pending' | 'Failed';
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  createdAt: Date;
}

/**
 * Represents a race entry for a horse
 */
export interface RaceEntry {
  entryID: string;
  raceID: string;
  horseID: string;
  jockeyID?: string;
  status: 'PendingConf' | 'Confirmed' | 'Cancelled' | 'Disqualified';
  entryFeeStatus: 'Unpaid' | 'Paid' | 'Refund Pending' | 'Refunded';
  registeredAt: Date;
  confirmedAt?: Date;
  cancelReason?: string;
}

/**
 * Represents an invitation sent to a jockey for a race
 */
export interface JockeyInvitation {
  invitationID: string;
  raceID: string;
  ownerID: string;
  jockeyID: string;
  jockeyName?: string;
  status: 'Pending' | 'Accept' | 'Decline';
  invitedAt: Date;
  respondedAt?: Date;
}

/**
 * Represents a horse breed
 */
export interface Breed {
  breedCode: string;
  breedName: string;
}