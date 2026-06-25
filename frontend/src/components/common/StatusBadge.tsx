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