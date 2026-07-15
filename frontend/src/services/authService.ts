// ─── Cổng dịch vụ Auth ──────────────────────────────────────────────────────
// Component luôn import các hàm xác thực từ file này.

import { apiFetch } from './apiClient';
import type { Role, User } from '../types';

// ─── Kiểu dữ liệu phản hồi chung từ API ─────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

// ─── Login ──────────────────────────────────────────────────────────────────

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

export interface LoginResult {
  token: string;
  user: User;
}

export const login = async (
  payload: LoginPayload
): Promise<LoginResult> => {
  const res = await apiFetch<ApiResponse<LoginApiData>>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  if (!res.success || !res.data) {
    throw new Error(
      res.message || 'Đăng nhập thất bại.'
    );
  }

  const user: User = {
    userId: res.data.userId,
    username: payload.email.split('@')[0],
    fullName: res.data.fullName,
    email: payload.email,
    role: mapApiRoleToRole(
      res.data.role as string
    ),
    status: 'Active',
  };

  return {
    token: res.data.token,
    user,
  };
};

// ─── Logout ─────────────────────────────────────────────────────────────────

export const logout = async (): Promise<void> => {
  try {
    await apiFetch<ApiResponse<unknown>>(
      '/auth/logout',
      {
        method: 'POST',
      }
    );
  } catch {
    // Bỏ qua lỗi mạng hoặc timeout.
    // Token phía client vẫn được auth store xử lý.
  }
};

// ─── Register ────────────────────────────────────────────────────────────────

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

const mapRoleToApiRole = (
  role: Role
): string => {
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

const mapApiRoleToRole = (
  apiRole: string
): Role => {
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
 * Đăng ký sử dụng multipart/form-data vì Jockey/Referee/Doctor
 * có thể gửi kèm certificateFile.
 *
 * Không tự set Content-Type vì apiClient sẽ để browser tự sinh boundary.
 */
export const register = async (
  payload: RegisterPayload
): Promise<RegisterResult> => {
  const verification =
    payload.verificationData ?? {};

  const formData = new FormData();

  formData.append(
    'username',
    payload.username
  );

  formData.append(
    'fullName',
    payload.fullName
  );

  formData.append(
    'email',
    payload.email
  );

  formData.append(
    'password',
    payload.password
  );

  formData.append(
    'role',
    mapRoleToApiRole(payload.role)
  );

  const appendIfPresent = (
    key: string,
    value: unknown
  ) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      formData.append(key, String(value));
    }
  };

  // Dữ liệu chung của Owner/Jockey/Referee/Doctor.
  appendIfPresent(
    'phoneNumber',
    verification.phoneNumber
  );

  appendIfPresent(
    'identityNumber',
    verification.identityNumber
  );

  appendIfPresent(
    'dateOfBirth',
    verification.dateOfBirth
  );

  // Dữ liệu riêng của Jockey.
  appendIfPresent(
    'experienceYears',
    verification.experienceYears
  );

  appendIfPresent(
    'selfDeclaredWeight',
    verification.selfDeclaredWeight
  );

  appendIfPresent(
    'bloodType',
    verification.bloodType
  );

  appendIfPresent(
    'healthStatus',
    verification.healthStatus
  );

  // File chứng chỉ chỉ dùng cho Jockey/Referee/Doctor.
  const certificateFile =
    verification.certificateFile as
      | File
      | null
      | undefined;

  if (certificateFile) {
    formData.append(
      'certificateFile',
      certificateFile
    );
  }

  const res = await apiFetch<
    ApiResponse<unknown>
  >('/auth/register', {
    method: 'POST',
    body: formData,
  });

  if (!res.success) {
    throw new Error(
      res.message || 'Đăng ký thất bại.'
    );
  }

  return {
    success: true,
    message:
      res.message || 'Đăng ký thành công.',
    walletBonus:
      payload.role === 'Spectator'
        ? 1000
        : undefined,
  };
};