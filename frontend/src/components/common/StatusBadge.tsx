import styles from './StatusBadge.module.scss';

export type StatusType =
  | 'Pending'
  | 'Approved'
  | 'Active'
  | 'Rejected'
  | 'AutoRejected'
  | 'Withdrawn'
  | 'Disqualified';

interface StatusBadgeProps {
  status: StatusType;
  label?: string; // cho phép override nhãn hiển thị nếu cần
}

// ─── Convention màu chuẩn (chưa có bảng màu chính thức từ SRS 3.1.3) ────────
// Pending      → vàng/cam (chờ xử lý)
// Approved/Active → xanh lá (đã xác nhận, hợp lệ)
// Rejected     → đỏ (bị từ chối bởi Admin)
// AutoRejected → xám (hệ thống tự loại, không phải quyết định Admin)
// Withdrawn / Disqualified → đỏ đậm (cảnh báo nghiêm trọng — khớp tile URGENT ở Dashboard)
const STATUS_CONFIG: Record<StatusType, { label: string; className: string }> = {
  Pending: { label: 'Pending', className: 'statusPending' },
  Approved: { label: 'Approved', className: 'statusApproved' },
  Active: { label: 'Active', className: 'statusApproved' },
  Rejected: { label: 'Rejected', className: 'statusRejected' },
  AutoRejected: { label: 'Auto-Rejected', className: 'statusAutoRejected' },
  Withdrawn: { label: 'Withdrawn', className: 'statusUrgent' },
  Disqualified: { label: 'Disqualified', className: 'statusUrgent' },
};

const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const config = STATUS_CONFIG[status];

  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>
      {label ?? config.label}
    </span>
  );
};

export default StatusBadge;