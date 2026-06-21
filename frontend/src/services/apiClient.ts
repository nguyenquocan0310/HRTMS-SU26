// ─── Cấu hình gọi API trung tâm ─────────────────────────────────────────────
// Mọi service thật (không phải mock) import từ đây.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5222/api';

export interface ApiErrorResponse {
  success: boolean;
  message: string;
  data: null;
}

/**
 * Wrapper fetch dùng chung — tự động gắn token, parse JSON, ném lỗi rõ ràng.
 * Token được authStore lưu dưới key 'token' (xem store/authStore.ts).
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem('token') ?? localStorage.getItem('token');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorBody: ApiErrorResponse | null = null;
    try {
      errorBody = await response.json();
    } catch {
      // response không có JSON body
    }
    throw new Error(errorBody?.message ?? `API error: ${response.status}`);
  }

  // Một số API trả về 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}