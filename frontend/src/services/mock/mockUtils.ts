// ─── Tiện ích dùng chung cho mọi mock service ──────────────────────────────
// File này (và cả thư mục services/mock/) sẽ bị XÓA khi toàn bộ hệ thống
// đã chuyển sang gọi API thật.

/** Giả lập độ trễ mạng để UI loading/spinner trông tự nhiên khi test. */
export const mockDelay = (ms = 350): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Tạo id giả duy nhất cho dữ liệu mock mới được thêm. */
export const generateMockId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;