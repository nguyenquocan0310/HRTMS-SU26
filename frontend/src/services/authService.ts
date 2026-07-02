// ─── Cổng dịch vụ Auth ──────────────────────────────────────────────────────
// Đã nối API thật (BE: localhost:5222). Component LUÔN import từ file này.

import { apiFetch } from './apiClient';
import type { Role, User } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

interface LoginApiData {
  token: string;
  userId: number;
  role: Role;
  fullName: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface LoginResult {
  token: string;
  user: User;
}

export const login = async (payload: LoginPayload): Promise<LoginResult> => {
  const res = await apiFetch<ApiResponse<LoginApiData>>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.success || !res.data) {
    throw new Error(res.message || 'Đăng nhập thất bại.');
  }

  const user: User = {
    userId: res.data.userId,
    username: payload.email.split('@')[0],
    fullName: res.data.fullName,
    email: payload.email,
    role: mapApiRoleToRole(res.data.role as string),
    status: 'Active',
  };

  return {
    token: res.data.token,
    user,
  };
};

export const logout = async (): Promise<void> => {
  try {
    await apiFetch<ApiResponse<unknown>>('/auth/logout', { method: 'POST' });
  } catch {
    // Bỏ qua lỗi mạng/timeout — vẫn xóa token ở client.
  }
};

export interface RegisterPayload {
  role: Role;
  username: string;
  fullName: string;
  email: string;
  password: string;
  verificationData?: Record<string, unknown>;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  walletBonus?: number;
}

const mapRoleToApiRole = (role: Role): string => {
  const mapping: Record<Role, string> = {
    Admin: 'Admin',
    HorseOwner: 'Owner',
    Owner: 'Owner',
    Jockey: 'Jockey',
    RaceReferee: 'Referee',
    Referee: 'Referee',
    Doctor: 'Doctor',
    Spectator: 'Spectator',
  };
  return mapping[role] ?? 'Spectator';
};

const mapApiRoleToRole = (apiRole: string): Role => {
  const mapping: Record<string, Role> = {
    Admin: 'Admin',
    Owner: 'HorseOwner',
    HorseOwner: 'HorseOwner',
    Jockey: 'Jockey',
    Referee: 'RaceReferee',
    RaceReferee: 'RaceReferee',
    Doctor: 'Doctor',
    Spectator: 'Spectator',
  };
  return mapping[apiRole] ?? 'Spectator';
};

interface RegisterApiPayload {
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: string;
  phoneNumber?: string;
  identityNumber?: string;
  dateOfBirth?: string;
  licenseCertificate?: string;
  experienceYears?: number;
  selfDeclaredWeight?: number;
  certificationLevel?: string;
  medicalLicenseNumber?: string;
  bloodType?: string;
  healthStatus?: string;
  familyDeclarations?: {
    relatedPersonName: string;
    relatedUserId?: number;
    relationType: string;
    relatedIdentityNumber: string;
    industryRole?: string;
    notes?: string;
  }[];
}

export const register = async (payload: RegisterPayload): Promise<RegisterResult> => {
  const v = payload.verificationData ?? {};

  const apiPayload: RegisterApiPayload = {
    username: payload.username,
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    role: mapRoleToApiRole(payload.role),
    phoneNumber: v.phoneNumber as string | undefined,
    identityNumber: v.identityNumber as string | undefined,
    dateOfBirth: v.dateOfBirth as string | undefined,
    licenseCertificate: v.licenseCertificate as string | undefined,
    experienceYears: v.experienceYears as number | undefined,
    selfDeclaredWeight: v.selfDeclaredWeight as number | undefined,
    certificationLevel: v.certificationLevel as string | undefined,
    medicalLicenseNumber: v.medicalLicenseNumber as string | undefined,
    bloodType: (v.bloodType as string) || undefined,
    healthStatus: (v.healthStatus as string) || undefined,
  };

  // familyDeclarations giờ luôn là mảng có cấu trúc (Jockey & Referee dùng
  // chung form StepVerification), field familyDeclaration (string) cũ chỉ
  // còn giữ lại ở type cho tương thích ngược, không dùng để submit nữa.
  const familyDeclarations = v.familyDeclarations as {
    relatedPersonName: string;
    relatedUserId?: number;
    relationType: string;
    relatedIdentityNumber: string;
    industryRole?: string;
    notes?: string;
  }[] | undefined;

  if (familyDeclarations && familyDeclarations.length > 0) {
    apiPayload.familyDeclarations = familyDeclarations;
  }

  const res = await apiFetch<ApiResponse<unknown>>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(apiPayload),
  });

  if (!res.success) {
    throw new Error(res.message || 'Đăng ký thất bại.');
  }

  return {
    success: true,
    message: res.message,
    walletBonus: payload.role === 'Spectator' ? 1000 : undefined,
  };
};