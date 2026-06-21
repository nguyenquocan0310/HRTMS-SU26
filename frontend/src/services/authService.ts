// ─── Cổng dịch vụ Auth ──────────────────────────────────────────────────────
// Component LUÔN import từ file này, KHÔNG import trực tiếp từ services/mock/.
//
// KHI CÓ API THẬT (Swagger):
// 1. Xóa toàn bộ nội dung dưới đây
// 2. Viết lại login/register gọi apiFetch thật, ví dụ:
//      export const login = (payload: LoginPayload) =>
//        apiFetch<LoginResult>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
// 3. Xóa file services/mock/authService.mock.ts
// 4. KHÔNG cần sửa LoginPage.tsx / RegisterPage.tsx vì chúng chỉ gọi
//    authService.login(...) / authService.register(...) — không biết gì về nguồn dữ liệu.

import * as mockAuth from './mock/authService.mock';

export type {
  LoginPayload,
  LoginResult,
  RegisterPayload,
  RegisterResult,
} from './mock/authService.mock';

export const login = mockAuth.login;
export const register = mockAuth.register;