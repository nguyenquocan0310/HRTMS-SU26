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

  // BE hiện chưa trả username/email/status trong response login —
  // tạm điền username = email (trước dấu @), status = Active.
  // TODO: nếu BE bổ sung GET /api/auth/me trả đủ field, gọi thêm để có User đầy đủ.
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

// Gọi BE để blacklist token (EC-29). Best-effort: nếu lỗi vẫn cho đăng xuất
// phía client (xóa token) để không kẹt người dùng.
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

// BE dùng tên role NGẮN (Owner/Referee), khác RegRole enum của FE
// (HorseOwner/RaceReferee) — map tường minh để tránh sai lệch.
const mapRoleToApiRole = (role: Role): string => {
  const mapping: Record<Role, string> = {
    Admin: 'Admin',
    HorseOwner: 'Owner',       // FE → BE
    Owner: 'Owner',
    Jockey: 'Jockey',
    RaceReferee: 'Referee',    // FE → BE
    Referee: 'Referee',
    Doctor: 'Doctor',
    Spectator: 'Spectator',
  };
  return mapping[role] ?? 'Spectator';
};

const mapApiRoleToRole = (apiRole: string): Role => {
  const mapping: Record<string, Role> = {
    Admin: 'Admin',
    Owner: 'HorseOwner',       // BE → FE
    HorseOwner: 'HorseOwner',
    Jockey: 'Jockey',
    Referee: 'RaceReferee',    // BE → FE
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
    industryRole?: string;
    notes?: string;
  }[];
}

export const register = async (payload: RegisterPayload): Promise<RegisterResult> => {
  // Gộp verificationData (đang lồng theo role ở FE) thành flat object đúng
  // chuẩn RegisterDto của BE.
  const v = payload.verificationData ?? {};

  const apiPayload: RegisterApiPayload = {
    username: payload.username,
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    role: mapRoleToApiRole(payload.role),
    phoneNumber: v.phoneNumber as string | undefined,
    identityNumber: v.identityNumber as string | undefined,
    licenseCertificate: v.licenseCertificate as string | undefined,
    experienceYears: v.experienceYears as number | undefined,
    selfDeclaredWeight: v.selfDeclaredWeight as number | undefined,
    certificationLevel: v.certificationLevel as string | undefined,
    medicalLicenseNumber: v.medicalLicenseNumber as string | undefined,
  bloodType: (v.bloodType as string) || undefined,
  healthStatus: (v.healthStatus as string) || undefined,
  };

  // familyDeclaration ở FE là 1 chuỗi text tự do, BE cần mảng object có cấu
  // trúc — nếu có nội dung, gói lại thành 1 item đơn giản.
  // familyDeclarations: nếu có mảng thật (từ Jockey form mới) thì dùng luôn,
  // nếu chỉ có text tự do (legacy) thì wrap lại.
  const familyDeclarations = v.familyDeclarations as {
    relatedPersonName: string;
    relatedUserId?: number;
    relationType: string;
    industryRole?: string;
    notes?: string;
  }[] | undefined;

  const familyText = v.familyDeclaration as string | undefined;

  if (familyDeclarations && familyDeclarations.length > 0) {
    apiPayload.familyDeclarations = familyDeclarations;
  } else if (familyText && familyText.trim() !== '' && familyText.trim().toLowerCase() !== 'none') {
    apiPayload.familyDeclarations = [
      {
        relatedPersonName: 'N/A',
        relationType: familyText,
      },
    ];
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