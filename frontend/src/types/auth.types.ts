import { RegRole } from './role.types';

// ─── Step 2: Identity ─────────────────────────────────────────────────────────
export interface IdentityData {
  username: string;
  fullName: string;
  email: string;
}
// ─── Step 3: Credentials ─────────────────────────────────────────────────────
export interface CredentialsData {
  password: string;
  confirmPassword: string;
}

// ─── Step 4: Verification (theo từng role) ───────────────────────────────────
export interface OwnerVerification {
  phoneNumber: string;
  identityNumber: string;
}

export interface JockeyVerification {
  licenseCertificate: string;
  experienceYears: number | '';
  selfDeclaredWeight: number | '';
  bloodType: string;
  healthStatus: string;
  familyDeclaration: string; // giữ lại cho backward compat
  // Mảng khai báo gia đình có cấu trúc đúng
  familyDeclarations: {
    relatedPersonName: string;
    relationType: string;
    industryRole: string;
    notes: string;
  }[];
}

export interface RefereeVerification {
  certificationLevel: 'Level1' | 'Level2' | 'Level3' | '';
  familyDeclaration: string;             // Family / Conflict of Interest
}

export interface DoctorVerification {
  medicalLicenseNumber: string;
  // NOTE: Doctor khai báo COI tại Doctor Dashboard UI-S30, không phải lúc Register
}

// Spectator không có verification data

// ─── Toàn bộ form data xuyên suốt 6 bước ────────────────────────────────────
export interface RegisterFormData {
  // Bước 1
  role: RegRole | null;

  // Bước 2
  identity: IdentityData;

  // Bước 3
  credentials: CredentialsData;

  // Bước 4 (chỉ field của role tương ứng được dùng)
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
  },
  jockeyVerification: {
  licenseCertificate: '',
  experienceYears: '',
  selfDeclaredWeight: '',
  bloodType: '',
  healthStatus: '',
  familyDeclaration: '',
  familyDeclarations: [],
},
  refereeVerification: {
    certificationLevel: '',
    familyDeclaration: '',
  },
  doctorVerification: {
    medicalLicenseNumber: '',
  },
};