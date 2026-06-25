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
  | 'Live'
  | 'Upcoming'
  | 'Official'
  | 'Unofficial'
  | string; // ← thêm fallback cho status BE trả về không nằm trong list

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  Pending:          { label: 'Chờ duyệt',        className: 'statusPending' },
  Approved:         { label: 'Đã duyệt',          className: 'statusApproved' },
  Active:           { label: 'Đang hoạt động',    className: 'statusApproved' },
  Suspended:        { label: 'Đã khóa',           className: 'statusRejected' },
  Rejected:         { label: 'Từ chối',           className: 'statusRejected' },
  AutoRejected:     { label: 'Tự động từ chối',   className: 'statusAutoRejected' },
  Withdrawn:        { label: 'Đã rút lui',        className: 'statusUrgent' },
  Disqualified:     { label: 'Bị loại',           className: 'statusUrgent' },
  Draft:            { label: 'Bản nháp',          className: 'statusDraft' },
  OpenRegistration: { label: 'Đang mở đăng ký',  className: 'statusApproved' },
  Closed:           { label: 'Đã đóng',           className: 'statusAutoRejected' },
  Completed:        { label: 'Hoàn thành',        className: 'statusCompleted' },
  Cancelled:        { label: 'Đã hủy',            className: 'statusUrgent' },
  Live:             { label: 'Đang diễn ra',      className: 'statusApproved' },
  Upcoming:         { label: 'Sắp diễn ra',       className: 'statusPending' },
  Official:         { label: 'Chính thức',        className: 'statusCompleted' },
  Unofficial:       { label: 'Sơ bộ',             className: 'statusPending' },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  // ← guard: nếu status undefined/null hoặc không có trong config
  const config = STATUS_CONFIG[status] ?? {
    label: status ?? 'N/A',
    className: 'statusDraft'
  };

  return (
    <span className={`${styles.badge} ${styles[config.className]}`}>
      {label ?? config.label}
    </span>
  );
};

export default StatusBadge;