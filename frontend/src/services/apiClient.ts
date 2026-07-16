// ─── Cấu hình gọi API trung tâm ─────────────────────────────────────────────
// Mọi service thật (không phải mock) import từ đây.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5222/api';

export interface ApiErrorResponse {
  success?: boolean;
  message?: string;
  data?: null;
  // ASP.NET tự động trả format này khi lỗi validate ở tầng DataAnnotations
  // (vd MinLength, Required trên các DTO), khác với format
  // {success,message} tùy chỉnh của tầng business logic.
  title?: string;
  errors?: Record<string, string[]>;
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

// Khi body là FormData (upload file), KHÔNG được set Content-Type thủ công —
  // browser cần tự thêm boundary. Chỉ set JSON Content-Type khi body không phải FormData.
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    // 401 = token hết hạn / không hợp lệ / bị blacklist (EC-29).
    // Xóa token và đưa về trang đăng nhập thay vì kẹt ở "API error: 401".
    if (response.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        // Đánh dấu lý do để trang login có thể hiển thị thông báo (tùy chọn).
        sessionStorage.setItem('authReason', 'expired');
        window.location.href = '/login';
      }
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

let errorBody: ApiErrorResponse | null = null;
    try {
      errorBody = await response.json();
    } catch {
      // response không có JSON body
    }

    // Ưu tiên message tùy chỉnh của BE (tầng business logic).
    if (errorBody?.message) {
      throw new Error(errorBody.message);
    }

    // Fallback: lỗi validate tự động của ASP.NET (dạng { title, errors: {...} }).
    if (errorBody?.errors) {
      const detailMessages = Object.values(errorBody.errors).flat();
      if (detailMessages.length > 0) {
        throw new Error(detailMessages.join(' '));
      }
    }

    const fallbackMessage: Record<number, string> = {
      403: 'Bạn không có quyền thực hiện thao tác này.',
      404: 'Không tìm thấy dữ liệu cần xử lý.',
      409: 'Dữ liệu đã thay đổi hoặc đang có xung đột. Vui lòng tải lại và thử lại.',
      422: 'Dữ liệu chưa đáp ứng điều kiện để thực hiện thao tác.',
    };
    throw new Error(errorBody?.title ?? fallbackMessage[response.status] ?? 'Không thể kết nối với hệ thống. Vui lòng thử lại.');
  }

  // Một số API trả về 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
