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
  | 'ManualReview'
  | 'Open Registration'
  | 'Closed Registration'
  | 'Pre-Race'
  | 'In-Progress';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

const STATUS_CONFIG: Record<StatusType, { label: string; className: string }> = {
  Pending: { label: 'Chờ xử lý', className: 'statusPending' },
  Approved: { label: 'Đã phê duyệt', className: 'statusApproved' },
  Active: { label: 'Đang hoạt động', className: 'statusApproved' },
  Suspended: { label: 'Tạm ngưng', className: 'statusRejected' },
  Rejected: { label: 'Đã từ chối', className: 'statusRejected' },
  AutoRejected: { label: 'Tự động từ chối', className: 'statusAutoRejected' },
  Withdrawn: { label: 'Đã rút', className: 'statusUrgent' },
  Disqualified: { label: 'Bị loại', className: 'statusUrgent' },
  Draft: { label: 'Bản nháp', className: 'statusDraft' },
  OpenRegistration: { label: 'Đang mở đăng ký', className: 'statusApproved' },
  Closed: { label: 'Đã đóng', className: 'statusAutoRejected' },
  Completed: { label: 'Đã hoàn thành', className: 'statusCompleted' },
  Cancelled: { label: 'Đã hủy', className: 'statusUrgent' },
  ManualReview: { label: 'Chờ xem xét', className: 'statusPending' },
  'Open Registration': { label: 'Đang mở đăng ký', className: 'statusApproved' },
  'Closed Registration': { label: 'Đã đóng đăng ký', className: 'statusAutoRejected' },
  'Pre-Race': { label: 'Trước giờ đua', className: 'statusPending' },
  'In-Progress': { label: 'Đang diễn ra', className: 'statusCompleted' },
};

const FALLBACK = { label: 'Chưa xác định', className: 'statusDraft' as const };

const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status] ?? {
    label: FALLBACK.label,
    className: FALLBACK.className,
  };

  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>
      {label ?? config.label}
    </span>
  );
};

export default StatusBadge;
