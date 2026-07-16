export interface Horse {
  horseId?: number;
  breed: string;
  name: string;
  birthYear: number;
  gender: string;
  color: string;
  pedigree?: string;
  weight: number;
  identifyingMarks: string;
  vaccinationRecordRef?: string;
  dopingTestDate?: string;
  dopingTestResult?: string;
  legalConsentAccepted?: boolean;
  status?: 'Approved' | 'Pending' | 'Rejected';
  adminApprovalStatus?: string;
  rejectionReason?: string;
  horseID?: string;
  ownerID?: string;
  createdAt?: Date;
}

export interface RaceEntryRace {
  raceId: number;
  raceNumber: number;
  scheduledTime: string;
  tournamentName: string;
}

export interface RaceEntryHorse {
  horseId: number;
  name: string;
}

export interface RaceEntryJockey {
  jockeyId: number;
  fullName: string;
}

export interface RaceEntry {
  raceEntryId: number;
  race: RaceEntryRace;
  horse: RaceEntryHorse;
  jockey: RaceEntryJockey | null;
  status: string;
  entryFeeStatus: string;
  entryFeeAmount: number;
  createdAt: string;
}

export interface JockeyInvitation {
  invitationID: string;
  raceID: string;
  ownerID: string;
  jockeyID: string;
  jockeyName?: string;
  status: 'Pending' | 'Accepted' | 'Confirmed' | 'Declined' | 'Cancelled';
  invitedAt: Date;
  respondedAt?: Date;
  horseID?: string;
  horseName?: string;
  requestMessage?: string;
}

export interface Breed {
  breedCode: string;
  breedName: string;
}

export interface OwnerPayout {
  pursePayoutId: number;
  raceEntryId: number;
  recipientUserId: number;
  recipientName: string;
  role: string;
  finishPosition: number;
  horseName: string;
  calculatedAmount: number;
  payoutStatus: string;
  paidAt: string | null;
  updatedByAdminId: number | null;
  updatedAt: string;
}

export interface OwnerEarnings {
  ownerUserId: number;
  totalEarnings: number;
  paidAmount: number;
  unpaidAmount: number;
  payoutCount: number;
  payouts: OwnerPayout[];
}

export interface RacePurseSummary {
  raceId: number;
  raceNumber: number;
  raceName: string;
  roundName: string;
  tournamentName: string;
  allocatedFund: number;
  paidAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  payoutStatus: string;
  resultStatus: string;
  hasDiscrepancy: boolean;
  discrepancyAmount: number | null;
  payouts: OwnerPayout[];
}
