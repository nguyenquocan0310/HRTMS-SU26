import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiFlag, FiUserCheck,
  FiArrowRight, FiPlus, FiCheckCircle, FiAward,
  FiShuffle, FiFileText, FiUser,
} from 'react-icons/fi';
import StatTile from '../../components/common/StatTile';
import * as tournamentService from '../../services/tournamentService';
import type { TournamentResponse } from '../../services/tournamentService';
import { getPendingApprovalsCount, getRecentAuditLogs, type AuditLogItem } from '../../services/adminService';
import styles from './AdminDashboard.module.scss';

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
  id: number; icon: React.ReactNode; title: string; desc: string; time: string;
}

const mapAuditToActivity = (log: AuditLogItem): ActivityItem => {
  const { icon, title } = actionMeta(log.action);
  const entity = log.entityName ? `${log.entityName} #${log.entityId}` : `#${log.entityId}`;
  const change = log.oldValue && log.newValue ? ` (${log.oldValue} → ${log.newValue})` : '';
  return { id: log.auditLogId, icon, title, desc: `${entity}${change}`, time: relativeTime(log.createdAt) };
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
};

const statusLabel = (s: string) => {
  const map: Record<string,string> = {
    OpenRegistration: 'Open Registration', 'Open Registration': 'Open Registration',
    Draft: 'Draft', Completed: 'Completed', Cancelled: 'Cancelled',
    'Closed Registration': 'Closed', 'Pre-Race': 'Pre-Race', 'In-Progress': 'In Progress',
  };
  return map[s] ?? s;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [openTournaments, setOpenTournaments] = useState<number | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);

  useEffect(() => {
    tournamentService.getTournaments().then((list) => {
      setTournaments(list);
      setOpenTournaments(list.filter((t) => t.status === 'Open Registration' || t.status === 'OpenRegistration').length);
    }).catch(() => setOpenTournaments(0));

    getPendingApprovalsCount().then(setPendingApprovals).catch(() => setPendingApprovals(0));

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
          <Link to="/admin/approval-center" className={styles.btnOutline}>Review applicants</Link>
          <Link to="/admin/tournament-builder" className={styles.btnPrimary}>
            <FiPlus size={16} /> Create tournament
          </Link>
        </div>
      </div>

      {/* ═══ STAT TILES ═══════════════════════════════════════ */}
      <div className={styles.statGrid}>
        <StatTile label="Open tourna..." value={openTournaments ?? '—'} icon={<FiFlag />} linkTo="/admin/tournaments" />
        <StatTile label="Pending appr..." value={pendingApprovals ?? '—'} icon={<FiUserCheck />} linkTo="/admin/approval-center" />  
      </div>

      {/* ═══ OPEN TOURNAMENTS LIST ════════════════════════════ */}
<div className={styles.integrityMap}>
  <div className={styles.openTourHeader}>
    <h3 className={styles.cardTitle}>Giải đấu đang mở</h3>
    <span className={styles.openTourSub}>Operational preview</span>
  </div>

  {tournaments.length === 0 ? (
    <p className={styles.emptyText}>Chưa có giải đấu nào.</p>
  ) : (
    <div className={styles.tourList}>
      {tournaments.map((t) => (
        <button
          key={t.tournamentId}
          type="button"
          className={styles.tourRow}
          onClick={() => navigate(`/admin/tournament-builder/${t.tournamentId}`)}
        >
          <div className={styles.tourInfo}>
            <span className={styles.tourName}>{t.name}</span>
            <span className={styles.tourMeta}>
              {t.allowedBreed} · {formatDate(t.startDate)} – {formatDate(t.endDate)}
            </span>
          </div>
          <div className={styles.tourRight}>
            <span className={styles.tourStatus}>{statusLabel(t.status)}</span>
            <FiArrowRight size={14} className={styles.tourArrow} />
          </div>
        </button>
      ))}
    </div>
  )}
</div>

      {/* ═══ RECENT ACTIVITY ══════════════════════════════════ */}
      <div className={styles.activityCard}>
        <div className={styles.activityHeader}>
          <div>
            <h3 className={styles.cardTitle}>Recent Activity</h3>
            <p className={styles.activitySubtext}>Latest audit events from the backend audit log.</p>
          </div>
          <Link to="/admin/audit-log-viewer" className={styles.viewAllLink}>
            Full audit route pending
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