import type { RegRole } from './role.types';

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

// ─── Khai báo xung đột lợi ích (gia đình) — dùng chung cho cả 4 role ────────
export interface FamilyDeclarationItem {
  relatedPersonName: string;
  relationType: string;
  relatedIdentityNumber: string;
  industryRole: string;
  notes: string;
}

// ─── Step 4: Verification (theo từng role) ──────────────────────────────────
// Owner/Jockey/Referee/Doctor đều bắt buộc PhoneNumber + DateOfBirth + IdentityNumber (ACC.1A).
// Cả 4 role đều bắt buộc khai báo gia đình (COI): hoặc có ít nhất 1 khai báo trong
// familyDeclarations, hoặc nhập noFamilyDeclarationNote (ví dụ: "Không có người thân
// làm trong ngành này"). Không được để trống cả hai.
export interface OwnerVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
  noFamilyDeclarationNote: string;
  familyDeclarations: FamilyDeclarationItem[];
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
  noFamilyDeclarationNote: string;
  familyDeclaration: string; // giữ lại cho backward compat, KHÔNG dùng để submit nữa
  familyDeclarations: FamilyDeclarationItem[];
}

export interface RefereeVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
  certificateFile: File | null;
  noFamilyDeclarationNote: string;
  familyDeclaration: string; // giữ lại cho backward compat, KHÔNG dùng để submit nữa
  familyDeclarations: FamilyDeclarationItem[];
}

export interface DoctorVerification {
  phoneNumber: string;
  identityNumber: string;
  dateOfBirth: string;
  certificateFile: File | null;
  noFamilyDeclarationNote: string;
  familyDeclarations: FamilyDeclarationItem[];
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
    noFamilyDeclarationNote: '',
    familyDeclarations: [],
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
    noFamilyDeclarationNote: '',
    familyDeclaration: '',
    familyDeclarations: [],
  },
  refereeVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
    certificateFile: null,
    noFamilyDeclarationNote: '',
    familyDeclaration: '',
    familyDeclarations: [],
  },
  doctorVerification: {
    phoneNumber: '',
    identityNumber: '',
    dateOfBirth: '',
    certificateFile: null,
    noFamilyDeclarationNote: '',
    familyDeclarations: [],
  },
};
