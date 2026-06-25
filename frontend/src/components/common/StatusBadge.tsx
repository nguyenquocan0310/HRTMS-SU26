import styles from './StatusBadge.module.scss';

export type StatusType =
  | 'Pending'
  | 'Approved'
  | 'Active'
  | 'Suspended'
  | 'Rejected'
  | 'AutoRejected'
  | 'Withdrawn'
  | 'Disqualified'
  | 'Draft'
  | 'OpenRegistration'
  | 'Closed'
  | 'Completed'
  | 'Cancelled'
  // ─── Tournament statuses thật từ DB (CHK_Tournaments_Status) ───────────────
  | 'Open Registration'
  | 'Closed Registration'
  | 'Pre-Race'
  | 'In-Progress';

interface StatusBadgeProps {
  status: StatusType;
  label?: string; // cho phép override nhãn hiển thị nếu cần
}

// ─── Convention màu chuẩn (chưa có bảng màu chính thức từ SRS 3.1.3) ────────
// Pending      → vàng/cam (chờ xử lý)
// Approved/Active/OpenRegistration → xanh lá (đã xác nhận, hợp lệ, đang mở)
// Rejected/Suspended → đỏ (bị từ chối/khóa bởi Admin)
// AutoRejected → xám (hệ thống tự loại, không phải quyết định Admin)
// Withdrawn / Disqualified / Cancelled → đỏ đậm (cảnh báo nghiêm trọng, bất khả hồi)
// Draft        → xám nhạt (chưa publish)
// Closed       → xám (đã đóng, không còn nhận đăng ký)
// Completed    → xanh dương (đã hoàn tất bình thường)
const STATUS_CONFIG: Record<StatusType, { label: string; className: string }> = {
  Pending: { label: 'Pending', className: 'statusPending' },
  Approved: { label: 'Approved', className: 'statusApproved' },
  Active: { label: 'Active', className: 'statusApproved' },
  Suspended: { label: 'Suspended', className: 'statusRejected' },
  Rejected: { label: 'Rejected', className: 'statusRejected' },
  AutoRejected: { label: 'Auto-Rejected', className: 'statusAutoRejected' },
  Withdrawn: { label: 'Withdrawn', className: 'statusUrgent' },
  Disqualified: { label: 'Disqualified', className: 'statusUrgent' },
  Draft: { label: 'Draft', className: 'statusDraft' },
  OpenRegistration: { label: 'Open Registration', className: 'statusApproved' },
  Closed: { label: 'Closed', className: 'statusAutoRejected' },
  Completed: { label: 'Completed', className: 'statusCompleted' },
  Cancelled: { label: 'Cancelled', className: 'statusUrgent' },
  // ─── Tournament statuses thật từ DB ───────────────────────────────────────
  'Open Registration': { label: 'Open Registration', className: 'statusApproved' },
  'Closed Registration': { label: 'Closed Registration', className: 'statusAutoRejected' },
  'Pre-Race': { label: 'Pre-Race', className: 'statusPending' },
  'In-Progress': { label: 'In-Progress', className: 'statusCompleted' },
};

// Fallback an toàn: status lạ (không có trong map) sẽ KHÔNG làm crash cây React.
const FALLBACK = { label: 'Unknown', className: 'statusDraft' as const };

const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status] ?? {
label: status ? String(status) : FALLBACK.label,
    className: FALLBACK.className,
  };

  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>
      {label ?? config.label}
    </span>
  );
};

export default StatusBadge;
