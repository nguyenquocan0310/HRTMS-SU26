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
} from 'react-icons/fi';
import StatTile from '../../components/common/StatTile';
import styles from './AdminDashboard.module.scss';

// ─── Mock data — TODO: thay bằng API thống kê khi có Swagger từ BE (Điều 6) ──
// Dự kiến: GET /api/admin/dashboard/stats
const MOCK_STATS = {
  openTournaments: 6,
  pendingApprovals: 14,
  upcomingRaces: 9,
  urgentAlerts: 3, // gồm Withdrawal + Disqualification
};

// TODO: thay bằng API Audit Log mới nhất — GET /api/admin/audit-log?limit=5
const RECENT_ACTIVITY = [
  {
    id: 1,
    icon: <FiFlag size={16} />,
    title: 'Tạo giải đấu mới',
    desc: 'Royal Stakes — Ascot Cup 2024 đã được khởi tạo',
    time: '5 phút trước',
  },
  {
    id: 2,
    icon: <FiCheckCircle size={16} />,
    title: 'Duyệt hồ sơ',
    desc: 'Hồ sơ Jockey "Nguyễn Văn A" đã được phê duyệt',
    time: '22 phút trước',
  },
  {
    id: 3,
    icon: <FiShuffle size={16} />,
    title: 'Bốc thăm vòng đấu',
    desc: 'Round 2 — Dubai World Sprint đã hoàn tất bốc thăm',
    time: '1 giờ trước',
  },
  {
    id: 4,
    icon: <FiAward size={16} />,
    title: 'Declare Official',
    desc: 'Kết quả chính thức Race #14 đã được công bố',
    time: '3 giờ trước',
  },
  {
    id: 5,
    icon: <FiFileText size={16} />,
    title: 'Cập nhật phí tham dự',
    desc: 'Entry Fee cho Melbourne Classic đã được điều chỉnh',
    time: '5 giờ trước',
  },
];

const AdminDashboard = () => {
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
          value={MOCK_STATS.openTournaments}
          icon={<FiFlag />}
          linkTo="/admin/tournament-builder"
        />
        <StatTile
          label="Hồ sơ chờ duyệt"
          value={MOCK_STATS.pendingApprovals}
          icon={<FiUserCheck />}
          linkTo="/admin/approval-center"
        />
        <StatTile
          label="Race sắp diễn ra"
          value={MOCK_STATS.upcomingRaces}
          icon={<FiCalendar />}
        />
        <StatTile
          label="Cảnh báo URGENT"
          value={MOCK_STATS.urgentAlerts}
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
          {RECENT_ACTIVITY.map((item) => (
            <li key={item.id} className={styles.activityItem}>
              <div className={styles.activityIcon}>{item.icon}</div>
              <div className={styles.activityText}>
                <span className={styles.activityTitle}>{item.title}</span>
                <span className={styles.activityDesc}>{item.desc}</span>
              </div>
              <span className={styles.activityTime}>{item.time}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.footerNote}>Cập nhật lần cuối: vừa xong</div>
    </div>
  );
};

export default AdminDashboard;