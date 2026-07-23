// Tiện ích đếm ngược deadline lệ phí (patch 012).
// Dùng chung cho màn nộp phí của Owner, màn đối chiếu của Admin và trang chi
// tiết giải đấu — để cách hiển thị "còn X ngày" nhất quán mọi nơi.

export type DeadlineUrgency = 'none' | 'normal' | 'urgent' | 'passed';

export interface DeadlineInfo {
  /** null nếu giải không đặt deadline. */
  date: Date | null;
  /** Đã qua hạn chưa. */
  isPassed: boolean;
  /** Số giờ còn lại (âm nếu đã qua). null nếu không có deadline. */
  hoursLeft: number | null;
  /** 'urgent' khi còn dưới 48h — FE tô đỏ cảnh báo. */
  urgency: DeadlineUrgency;
  /** Chuỗi đếm ngược tiếng Việt, vd "còn 3 ngày", "còn 5 giờ", "đã quá hạn". */
  label: string;
  /** Ngày giờ định dạng dd/MM/yyyy HH:mm, '—' nếu không có. */
  formatted: string;
}

const HOURS_URGENT = 48;

export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const getDeadlineInfo = (
  value?: string | Date | null,
  now: Date = new Date()
): DeadlineInfo => {
  if (!value) {
    return {
      date: null,
      isPassed: false,
      hoursLeft: null,
      urgency: 'none',
      label: 'Không giới hạn',
      formatted: '—',
    };
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: null,
      isPassed: false,
      hoursLeft: null,
      urgency: 'none',
      label: '—',
      formatted: '—',
    };
  }

  const msLeft = date.getTime() - now.getTime();
  const hoursLeft = msLeft / (1000 * 60 * 60);
  const isPassed = msLeft <= 0;

  let label: string;
  if (isPassed) {
    label = 'Đã quá hạn';
  } else if (hoursLeft < 1) {
    label = `còn ${Math.max(1, Math.floor(msLeft / (1000 * 60)))} phút`;
  } else if (hoursLeft < 24) {
    label = `còn ${Math.floor(hoursLeft)} giờ`;
  } else {
    label = `còn ${Math.floor(hoursLeft / 24)} ngày`;
  }

  return {
    date,
    isPassed,
    hoursLeft,
    urgency: isPassed
      ? 'passed'
      : hoursLeft < HOURS_URGENT
        ? 'urgent'
        : 'normal',
    label,
    formatted: formatDateTime(date),
  };
};
