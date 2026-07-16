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

// ─── Step 4: Verification ───────────────────────────────────────────────────

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

// ─── Toàn bộ dữ liệu Register ───────────────────────────────────────────────

export interface RegisterFormData {
  role: RegRole | null;
  identity: IdentityData;
  credentials: CredentialsData;
  ownerVerification: OwnerVerification;
  jockeyVerification: JockeyVerification;
  refereeVerification: RefereeVerification;
  doctorVerification: DoctorVerification;
}

// ─── Validation errors ──────────────────────────────────────────────────────

export interface RegisterFormErrors {
  role?: string;

  identity?: Partial<Record<keyof IdentityData, string>>;

  credentials?: Partial<Record<keyof CredentialsData, string>>;

  ownerVerification?: Partial<
    Record<keyof OwnerVerification, string>
  >;

  jockeyVerification?: Partial<
    Record<keyof JockeyVerification, string>
  >;

  refereeVerification?: Partial<
    Record<keyof RefereeVerification, string>
  >;

  doctorVerification?: Partial<
    Record<keyof DoctorVerification, string>
  >;
}

// ─── Giá trị khởi tạo ───────────────────────────────────────────────────────

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