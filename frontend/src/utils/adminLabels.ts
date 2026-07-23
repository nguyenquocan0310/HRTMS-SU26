import { ApiRequestError } from '../services/apiClient';

const labels: Record<string, string> = {
  Draft: 'Bản nháp', OpenRegistration: 'Đang mở đăng ký', 'Open Registration': 'Đang mở đăng ký',
  ClosedRegistration: 'Đã đóng đăng ký', 'Closed Registration': 'Đã đóng đăng ký',
  Upcoming: 'Sắp diễn ra', InProgress: 'Đang diễn ra', 'In-Progress': 'Đang diễn ra',
  Completed: 'Đã hoàn thành', Cancelled: 'Đã hủy',
  Pending: 'Đang chờ', Accepted: 'Nài đã đồng ý', PendingVerification: 'Chờ đối chiếu lệ phí',
  Confirmed: 'Đã xác nhận', Declined: 'Đã từ chối', Rejected: 'Đã từ chối',
  Verified: 'Đã xác nhận', RefundPending: 'Đang chờ hoàn phí', Refunded: 'Đã hoàn phí',
  Unofficial: 'Chưa chính thức', Official: 'Chính thức', Scratched: 'Rút lui sau bốc thăm',
  Qualified: 'Đủ điều kiện đi tiếp', AlsoEligible: 'Dự bị đi tiếp',
  Dirt: 'Đường đất', Turf: 'Đường cỏ', Synthetic: 'Mặt sân tổng hợp',
  Cash: 'Tiền mặt', Transfer: 'Chuyển khoản', Paid: 'Đã thanh toán', Unpaid: 'Chưa thanh toán',
  NOT_ENOUGH_ENTRIES: 'Không đủ ít nhất 2 ngựa hợp lệ.', ALREADY_DRAWN: 'Cuộc đua đã được bốc thăm trước đó.',
  NO_ELIGIBLE_ENTRIES: 'Không có đăng ký hợp lệ.', ENTRIES_NOT_ALL_CONFIRMED: 'Vẫn còn đăng ký chưa xác nhận.',
  MAX_LANES_REACHED: 'Số ngựa vượt số làn sân.', DRAW_CONFLICT: 'Xung đột vị trí xuất phát.',
};

const errors: Record<string, string> = {
  VENUE_NOT_FOUND: 'Không tìm thấy trường đua.', VENUE_INACTIVE: 'Trường đua đang tạm ngừng hoạt động.',
  VENUE_REQUIRED: 'Vui lòng chọn trường đua.', MAX_HORSES_EXCEEDS_LANES: 'Số ngựa tối đa không được vượt quá số làn xuất phát.',
  TRACK_TYPE_VENUE_MISMATCH: 'Loại mặt sân phải khớp với trường đua đã chọn.',
  FIELD_LOCKED_OPEN_REGISTRATION: 'Không thể thay đổi thông tin này khi giải đang mở đăng ký.',
  INVALID_VENUE_DATA: 'Thông tin trường đua không hợp lệ.', VENUE_NAME_DUPLICATE: 'Tên trường đua đã tồn tại.',
  LANE_COUNT_BELOW_TOURNAMENT_MAX_HORSES: 'Không thể giảm số làn dưới cấu hình của giải đang dùng sân.',
  VENUE_TRACK_TYPE_IN_USE: 'Không thể đổi loại mặt sân khi còn giải đấu đang sử dụng.',
  PAYMENT_DEADLINE_REQUIRED: 'Vui lòng đặt hạn nộp lệ phí.', PAYMENT_DEADLINE_OUT_OF_RANGE: 'Hạn nộp lệ phí phải sau hiện tại và trước ngày khai mạc ít nhất 24 giờ.',
  REFUND_DEADLINE_INVALID: 'Hạn hoàn lệ phí không hợp lệ.', DEADLINE_LOCKED: 'Không thể đổi hạn sau khi đã qua hạn nộp lệ phí.',
  PAYMENT_NOT_FOUND: 'Không tìm thấy hồ sơ lệ phí.', PROOF_NOT_FOUND: 'Hồ sơ này không có chứng từ đính kèm.',
  PAYMENT_ALREADY_VERIFIED: 'Lệ phí này đã được xác nhận trước đó.', PAYMENT_NOT_PENDING: 'Lệ phí không còn ở trạng thái chờ đối chiếu.',
  REJECT_REASON_REQUIRED: 'Vui lòng nêu lý do từ chối tối thiểu 10 ký tự.', FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  ROUND_NOT_FOUND: 'Không tìm thấy vòng đấu.', TOURNAMENT_NOT_OPEN_FOR_SCHEDULING: 'Giải đấu chưa ở trạng thái cho phép điều hành.',
  NO_RACES_IN_ROUND: 'Vòng đấu chưa có cuộc đua nào.', ROUND_ALREADY_DRAWN: 'Vòng đấu đã được bốc thăm.',
  ROUND_ALREADY_ALLOCATED: 'Vòng đấu đã được phân cuộc đua.', PREVIOUS_ROUND_NOT_COMPLETED: 'Vòng trước chưa hoàn thành.',
  NO_ELIGIBLE_PAIRINGS: 'Chưa có cặp đấu đủ điều kiện.', ENTRY_NOT_FOUND: 'Không tìm thấy đăng ký cuộc đua.',
  TARGET_RACE_NOT_FOUND: 'Không tìm thấy cuộc đua đích.', RACE_NOT_IN_SAME_ROUND: 'Chỉ được chuyển trong cùng một vòng đấu.',
  ALREADY_DRAWN: 'Cuộc đua đã bốc thăm vị trí xuất phát.', MAX_LANES_REACHED: 'Cuộc đua đã đủ số làn xuất phát.',
  PAIRING_FEE_NOT_PAID: 'Cặp đấu chưa được xác nhận lệ phí.', DUPLICATE_IN_RACE: 'Ngựa hoặc nài đã có trong cuộc đua đích.',
  SAME_RACE: 'Đăng ký đã thuộc cuộc đua này.', INVALID_STATUS: 'Đăng ký không còn hiệu lực.',
  NO_ELIGIBLE_ENTRIES: 'Chưa có ngựa hợp lệ để bốc thăm.', NOT_ENOUGH_ENTRIES: 'Cần ít nhất 2 ngựa hợp lệ để bốc thăm.',
  ENTRIES_NOT_ALL_CONFIRMED: 'Vẫn còn đăng ký chưa được xác nhận.', DRAW_CONFLICT: 'Có xung đột khi bốc thăm. Vui lòng thử lại.',
};

export const adminLabel = (value?: string | null): string => value ? (labels[value] ?? value) : '—';
export const adminError = (error: unknown, fallback = 'Thao tác không thành công.'): string => {
  if (error instanceof ApiRequestError && error.code) return errors[error.code] ?? error.message;
  return error instanceof Error ? error.message : fallback;
};
export const currency = (value?: number | null) => `${Number(value ?? 0).toLocaleString('vi-VN')} đ`;
export const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
