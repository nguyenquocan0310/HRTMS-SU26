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
  ManualReview: { label: 'Manual Review', className: 'statusPending' },
  'Open Registration': { label: 'Open Registration', className: 'statusApproved' },
  'Closed Registration': { label: 'Closed Registration', className: 'statusAutoRejected' },
  'Pre-Race': { label: 'Pre-Race', className: 'statusPending' },
  'In-Progress': { label: 'In-Progress', className: 'statusCompleted' },
};

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