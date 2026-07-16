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

/**
 * Đăng ký giờ dùng multipart/form-data (BE yêu cầu, xem api-contract-certificate-upload.md)
 * vì có thể kèm file certificateFile (Jockey/Referee/Doctor). KHÔNG còn gửi JSON thuần.
 */
export const register = async (payload: RegisterPayload): Promise<RegisterResult> => {
  const v = payload.verificationData ?? {};

  const formData = new FormData();
  formData.append('username', payload.username);
  formData.append('fullName', payload.fullName);
  formData.append('email', payload.email);
  formData.append('password', payload.password);
  formData.append('role', mapRoleToApiRole(payload.role));

  const appendIfPresent = (key: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, String(value));
    }
  };

  appendIfPresent('phoneNumber', v.phoneNumber);
  appendIfPresent('identityNumber', v.identityNumber);
  appendIfPresent('dateOfBirth', v.dateOfBirth);
  appendIfPresent('experienceYears', v.experienceYears);
  appendIfPresent('selfDeclaredWeight', v.selfDeclaredWeight);
  appendIfPresent('bloodType', v.bloodType);
  appendIfPresent('healthStatus', v.healthStatus);

  // File chứng chỉ — chỉ Jockey/Referee/Doctor có, Owner không có field này.
  const certificateFile = v.certificateFile as File | null | undefined;
  if (certificateFile) {
    formData.append('certificateFile', certificateFile);
  }

  const res = await apiFetch<ApiResponse<unknown>>('/auth/register', {
    method: 'POST',
    body: formData,
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