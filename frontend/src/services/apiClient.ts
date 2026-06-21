// ─── Cấu hình gọi API trung tâm ─────────────────────────────────────────────
// Khi có Swagger từ BE, chỉ cần điền đúng BASE_URL bên dưới.
// Mọi service thật (không phải mock) sẽ import từ đây.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

export interface ApiErrorResponse {
  errorCode: string;
  message: string;
}

/**
 * Wrapper fetch dùng chung — tự động gắn token, parse JSON, ném lỗi rõ ràng.
 * TODO: khi có Swagger thật, kiểm tra lại path, headers (Authorization Bearer...)
 * cho khớp đúng chuẩn BE quy định.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = sessionStorage.getItem('hrtms_token') ?? localStorage.getItem('hrtms_token');

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