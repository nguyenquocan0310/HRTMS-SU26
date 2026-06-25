import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiFlag,
  FiUserCheck,
  FiCalendar,
  FiAlertTriangle,
  FiArrowRight,
  FiPlus,
  FiCheckCircle,
  FiAward,
  FiShuffle,
  FiFileText,
  FiUser,
} from 'react-icons/fi';
import StatTile from '../../components/common/StatTile';
import * as tournamentService from '../../services/tournamentService';
import { getPendingApprovalsCount, getRecentAuditLogs, type AuditLogItem } from '../../services/adminService';
import styles from './AdminDashboard.module.scss';

// ─── Map audit log (BE) → item hiển thị trong Recent Activity ────────────────
const relativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
};

const actionMeta = (action: string): { icon: React.ReactNode; title: string } => {
  const a = (action || '').toLowerCase();
  if (a.includes('login')) return { icon: <FiUser size={16} />, title: 'Đăng nhập' };
  if (a.includes('status')) return { icon: <FiShuffle size={16} />, title: 'Đổi trạng thái' };
  if (a.includes('approve') || a.includes('duyệt')) return { icon: <FiCheckCircle size={16} />, title: 'Duyệt hồ sơ' };
  if (a.includes('tournament')) return { icon: <FiFlag size={16} />, title: 'Giải đấu' };
  if (a.includes('result') || a.includes('official')) return { icon: <FiAward size={16} />, title: 'Kết quả' };
  return { icon: <FiFileText size={16} />, title: action || 'Hoạt động' };
};

interface ActivityItem {
  id: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
  time: string;
}

const mapAuditToActivity = (log: AuditLogItem): ActivityItem => {
  const { icon, title } = actionMeta(log.action);
  const entity = log.entityName ? `${log.entityName} #${log.entityId}` : `#${log.entityId}`;
  const change = log.oldValue && log.newValue ? ` (${log.oldValue} → ${log.newValue})` : '';
  return { id: log.auditLogId, icon, title, desc: `${entity}${change}`, time: relativeTime(log.createdAt) };
};

const AdminDashboard = () => {
  const [openTournaments, setOpenTournaments] = useState<number | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

  useEffect(() => {
    // Giải đang mở = đếm tournament có status "Open Registration".
    tournamentService
      .getTournaments()
      .then((list) => setOpenTournaments(list.filter((t) => t.status === 'Open Registration').length))
      .catch(() => setOpenTournaments(0));

    // Hồ sơ chờ duyệt.
    getPendingApprovalsCount().then(setPendingApprovals).catch(() => setPendingApprovals(0));

    // Recent Activity từ audit log.
    getRecentAuditLogs(5)
      .then((logs) => setActivity(logs.map(mapAuditToActivity)))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoaded(true));
  }, []);

  return (
    <div className={styles.container}>
      {/* ═══ HEADER ═══════════════════════════════════════════ */}
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>SYSTEM OVERVIEW</span>
          <h1 className={styles.heading}>Admin Dashboard</h1>
        </div>

        <div className={styles.headerActions}>
          <Link to="/admin/approval-center" className={styles.btnOutline}>
            Review Applicants
          </Link>
          <Link to="/admin/tournament-builder" className={styles.btnPrimary}>
            <FiPlus size={16} />
            Create Tournament
          </Link>
        </div>
      </div>

      {/* ═══ STAT TILES ═══════════════════════════════════════ */}
      <div className={styles.statGrid}>
        <StatTile
          label="Giải đang mở"
          value={openTournaments ?? '—'}
          icon={<FiFlag />}
          linkTo="/admin/tournaments"
        />
        <StatTile
          label="Hồ sơ chờ duyệt"
          value={pendingApprovals ?? '—'}
          icon={<FiUserCheck />}
          linkTo="/admin/approval-center"
        />
        {/* TODO(BE): chưa có API "race sắp diễn ra" — tạm placeholder. */}
        <StatTile
          label="Race sắp diễn ra"
          value="—"
          icon={<FiCalendar />}
        />
        {/* TODO(BE): chưa có API cảnh báo (Withdrawal + Disqualification) — placeholder. */}
        <StatTile
          label="Cảnh báo URGENT"
          value="—"
          icon={<FiAlertTriangle />}
          variant="urgent"
        />
      </div>

      {/* ═══ INTEGRITY MAP + SIDE CARDS ══════════════════════ */}
      <div className={styles.midRow}>
        <div className={styles.integrityMap}>
          <h3 className={styles.cardTitle}>Tournament Integrity Map</h3>
          <div className={styles.mapPlaceholder}>
            {/* Placeholder trực quan — chưa có yêu cầu nghiệp vụ cụ thể từ SRS */}
            <svg viewBox="0 0 400 200" className={styles.mapSvg}>
              <line x1="60" y1="50" x2="160" y2="100" stroke="#2a2a30" strokeWidth="1" />
              <line x1="160" y1="100" x2="260" y2="60" stroke="#2a2a30" strokeWidth="1" />
              <line x1="160" y1="100" x2="220" y2="160" stroke="#2a2a30" strokeWidth="1" />
              <line x1="260" y1="60" x2="340" y2="90" stroke="#2a2a30" strokeWidth="1" />
              <line x1="220" y1="160" x2="320" y2="150" stroke="#2a2a30" strokeWidth="1" />
              <circle cx="60" cy="50" r="5" fill="#B5121B" />
              <circle cx="160" cy="100" r="7" fill="#F3C8C3" />
              <circle cx="260" cy="60" r="5" fill="#B5121B" />
              <circle cx="340" cy="90" r="4" fill="#666" />
              <circle cx="220" cy="160" r="5" fill="#B5121B" />
              <circle cx="320" cy="150" r="4" fill="#666" />
            </svg>
          </div>
        </div>

        <div className={styles.sideCards}>
          <div className={styles.smallCard}>
            <h4 className={styles.smallCardTitle}>System Status</h4>
            <div className={styles.statusRow}>
              <span className={styles.statusDot} />
              <span>All systems operational</span>
            </div>
            <div className={styles.barWrap}>
              <div className={styles.bar} style={{ width: '92%' }} />
            </div>
          </div>

          <div className={styles.smallCard}>
            <h4 className={styles.smallCardTitle}>Network Load</h4>
            <div className={styles.loadValue}>34%</div>
            <div className={styles.barWrap}>
              <div className={styles.bar} style={{ width: '34%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RECENT ACTIVITY ══════════════════════════════════ */}
      <div className={styles.activityCard}>
        <div className={styles.activityHeader}>
          <h3 className={styles.cardTitle}>Recent Activity</h3>
          <Link to="/admin/audit-log-viewer" className={styles.viewAllLink}>
            View Full History <FiArrowRight size={14} />
          </Link>
        </div>

        <ul className={styles.activityList}>
          {activity.map((item) => (
            <li key={item.id} className={styles.activityItem}>
              <div className={styles.activityIcon}>{item.icon}</div>
              <div className={styles.activityText}>
                <span className={styles.activityTitle}>{item.title}</span>
                <span className={styles.activityDesc}>{item.desc}</span>
              </div>
              <span className={styles.activityTime}>{item.time}</span>
            </li>
          ))}
          {activityLoaded && activity.length === 0 && (
            <li className={styles.activityItem}>
              <div className={styles.activityText}>
                <span className={styles.activityDesc}>Chưa có hoạt động nào.</span>
              </div>
            </li>
          )}
        </ul>
      </div>

      <div className={styles.footerNote}>Cập nhật lần cuối: vừa xong</div>
    </div>
  );
};

export default AdminDashboard;