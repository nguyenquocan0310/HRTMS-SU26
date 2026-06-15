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
  status: 'Pending' | 'Accept' | 'Decline';
  invitedAt: Date;
  respondedAt?: Date;
}

export interface Breed {
  breedCode: string;
  breedName: string;
}