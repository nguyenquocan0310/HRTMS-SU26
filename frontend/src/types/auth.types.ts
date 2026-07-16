import { RegRole } from './role.types';

// ─── Step 2: Identity ───────────────────────────────────────────────────────
export interface IdentityData {
  username: string;
  fullName: string;
  email: string;
}
// ─── Step 3: Credentials ────────────────────────────────────────────────────
export interface CredentialsData {
  password: string;
  confirmPassword: string;
}

// ─── Step 4: Verification (theo từng role) ──────────────────────────────────
// Owner/Jockey/Referee/Doctor đều bắt buộc PhoneNumber + DateOfBirth + IdentityNumber (ACC.1A).
export interface OwnerVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
}

export interface JockeyVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
  experienceYears: number | '';
  selfDeclaredWeight: number | '';
  bloodType: string;
  healthStatus: string;
  certificateFile: File | null;
}

export interface RefereeVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
  certificateFile: File | null;
}

export interface DoctorVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
  certificateFile: File | null;
}

// Spectator không có verification data

// ─── Toàn bộ form data xuyên suốt 6 bước ────────────────────────────────────
export interface RegisterFormData {
  role: RegRole | null;
  identity: IdentityData;
  credentials: CredentialsData;
  ownerVerification: OwnerVerification;
  jockeyVerification: JockeyVerification;
  refereeVerification: RefereeVerification;
  doctorVerification: DoctorVerification;
}

// ─── Giá trị khởi tạo ────────────────────────────────────────────────────────
export const initialFormData: RegisterFormData = {
  role: null,
  identity: {
    username: '',
    fullName: '',
    email: '',
  },
  credentials: {
    password: '',
    confirmPassword: '',
  },
  ownerVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
  },
  jockeyVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
    experienceYears: '',
    selfDeclaredWeight: '',
    bloodType: '',
    healthStatus: '',
    certificateFile: null,
  },
  refereeVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
    certificateFile: null,
  },
  doctorVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
    certificateFile: null,
  },
};
