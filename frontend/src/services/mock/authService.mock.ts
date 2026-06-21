import type { Role, User } from '../../types';
import { mockDelay, generateMockId } from './mockUtils';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface LoginPayload {
  credential: string; // username hoặc email
  password: string;
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface RegisterPayload {
  role: Role;
  username: string;
  email: string;
  password: string;
  // Các field verification theo role (Owner/Jockey/Referee/Doctor) — optional
  // vì Spectator không cần
  verificationData?: Record<string, unknown>;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  walletBonus?: number; // chỉ Spectator nhận 1000 điểm
}

// ─── Tài khoản giả lập sẵn — dùng để test đăng nhập ─────────────────────────
// XÓA file này khi có API thật. Mật khẩu test: "Password123" cho tất cả.
const MOCK_ACCOUNTS: (User & { password: string })[] = [
  { userId: 1, username: 'admin', fullName: 'Admin User', email: 'admin@hrtms.com', role: 'Admin', status: 'Active', password: 'Password123' },
  { userId: 2, username: 'owner_demo', fullName: 'Nguyễn Văn Owner', email: 'owner@hrtms.com', role: 'HorseOwner', status: 'Active', password: 'Password123' },
  { userId: 3, username: 'jockey_demo', fullName: 'Trần Văn Jockey', email: 'jockey@hrtms.com', role: 'Jockey', status: 'Active', password: 'Password123' },
  { userId: 4, username: 'referee_demo', fullName: 'Lê Thị Referee', email: 'referee@hrtms.com', role: 'RaceReferee', status: 'Active', password: 'Password123' },
  { userId: 5, username: 'doctor_demo', fullName: 'Đỗ Quang Doctor', email: 'doctor@hrtms.com', role: 'Doctor', status: 'Active', password: 'Password123' },
  { userId: 6, username: 'spectator_demo', fullName: 'Phạm Spectator', email: 'spectator@hrtms.com', role: 'Spectator', status: 'Active', password: 'Password123' },
  { userId: 7, username: 'suspended_demo', fullName: 'Tài Khoản Khóa', email: 'suspended@hrtms.com', role: 'Jockey', status: 'Suspended', password: 'Password123' },
];

// ─── Login ──────────────────────────────────────────────────────────────────
export const login = async (payload: LoginPayload): Promise<LoginResult> => {
  await mockDelay();

  const account = MOCK_ACCOUNTS.find(
    (a) => a.username === payload.credential || a.email === payload.credential
  );

  if (!account) {
    throw new Error('Tài khoản không tồn tại.');
  }
  if (account.password !== payload.password) {
    throw new Error('Sai mật khẩu.');
  }
  if (account.status === 'Suspended') {
    throw new Error('Tài khoản đã bị tạm khóa. Vui lòng liên hệ Admin.');
  }
  if (account.status === 'Pending') {
    throw new Error('Hồ sơ của bạn đang chờ Admin xác nhận.');
  }
  if (account.status === 'Rejected') {
    throw new Error('Hồ sơ của bạn đã bị từ chối.');
  }

  const { password: _password, ...user } = account;

  return {
    token: `mock-token-${generateMockId('jwt')}`,
    user,
  };
};

// ─── Register ───────────────────────────────────────────────────────────────
export const register = async (payload: RegisterPayload): Promise<RegisterResult> => {
  await mockDelay();

  const exists = MOCK_ACCOUNTS.some(
    (a) => a.username === payload.username || a.email === payload.email
  );
  if (exists) {
    throw new Error('Username hoặc Email đã tồn tại.');
  }

  // TODO: khi có API thật, BE sẽ tự xác định cần Admin duyệt hay không theo role.
  if (payload.role === 'Spectator') {
    return {
      success: true,
      message: 'Tài khoản đã được tạo. Bạn đã nhận 1000 điểm vào Wallet. Hãy đăng nhập ngay.',
      walletBonus: 1000,
    };
  }

  return {
    success: true,
    message: 'Hồ sơ của bạn đã được gửi và đang chờ Admin xác nhận.',
  };
};