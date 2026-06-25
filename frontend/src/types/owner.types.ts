export interface Horse {
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

export interface JockeyInvitation {
  invitationID: string;
  raceID: string;
  ownerID: string;
  jockeyID: string;
  jockeyName?: string;
  status: 'Pending' | 'Accepted' | 'Declined';
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