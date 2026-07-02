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

// ─── Khai báo xung đột lợi ích (gia đình) — dùng chung cho Jockey & Referee ──
// BE bắt buộc RelatedIdentityNumber (CCCD người thân, 12 số) để đối chiếu xung đột lợi ích.
export interface FamilyDeclarationItem {
  relatedPersonName: string;
  relationType: string;
  relatedIdentityNumber: string;
  industryRole: string;
  notes: string;
}

// ─── Step 4: Verification (theo từng role) ───────────────────────────────────
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
  licenseCertificate: string;
  experienceYears: number | '';
  selfDeclaredWeight: number | '';
  bloodType: string;
  healthStatus: string;
  familyDeclaration: string; // giữ lại cho backward compat, KHÔNG dùng để submit nữa
  familyDeclarations: FamilyDeclarationItem[];
}

export interface RefereeVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
  certificationLevel: 'Level1' | 'Level2' | 'Level3' | '';
  familyDeclaration: string; // giữ lại cho backward compat, KHÔNG dùng để submit nữa
  familyDeclarations: FamilyDeclarationItem[];
}

export interface DoctorVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
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
    dateOfBirth: '',
  },
  jockeyVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
    licenseCertificate: '',
    experienceYears: '',
    selfDeclaredWeight: '',
    bloodType: '',
    healthStatus: '',
    familyDeclaration: '',
    familyDeclarations: [],
  },
  refereeVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
    certificationLevel: '',
    familyDeclaration: '',
    familyDeclarations: [],
  },
  doctorVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
    medicalLicenseNumber: '',
  },
};