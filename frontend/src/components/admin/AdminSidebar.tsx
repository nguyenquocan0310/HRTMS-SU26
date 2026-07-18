import { NavLink } from 'react-router-dom';
import {
  FiGrid, FiShield, FiUsers, FiList, FiPlusCircle,
  FiFlag, FiCreditCard, FiTrendingUp, FiChevronLeft,
  FiMonitor, FiBell, FiUser, FiAward, FiFileText, FiClock,FiCheckCircle
} from 'react-icons/fi';
import styles from './AdminSidebar.module.scss';


interface NavItem { label: string; path: string; icon: React.ReactNode; }

const OPERATIONS_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: <FiGrid size={18} /> },
  { label: 'Approval Center', path: '/admin/approval-center', icon: <FiShield size={18} /> },
  { label: 'Users', path: '/admin/users', icon: <FiUsers size={18} /> },
  { label: 'Tournaments', path: '/admin/tournaments', icon: <FiList size={18} /> },
  { label: 'Tournament Builder', path: '/admin/tournament-builder', icon: <FiPlusCircle size={18} /> },
  { label: 'Race Operations', path: '/admin/race-operations', icon: <FiFlag size={18} /> },
  { label: 'Race List', path: '/admin/race-list', icon: <FiCheckCircle size={18} /> },
  { label: 'Assign Officials', path: '/admin/assign-officials', icon: <FiUsers size={18} /> },
  { label: 'Entry Fees', path: '/admin/entry-fees', icon: <FiCreditCard size={18} /> },
  {
  label: 'Tạo mã Ticket',
  path: '/admin/ticket-codes',
  icon: <FiPlusCircle size={18} />,
},

  // Thêm ngay dưới Entry Fees
  { label: 'Quỹ & chi thưởng', path: '/admin/purse-payouts', icon: <FiAward size={18} /> },
  { label: 'Báo cáo', path: '/admin/reports', icon: <FiFileText size={18} /> },
  { label: 'Nhật ký hoạt động', path: '/admin/audit-log-viewer', icon: <FiClock size={18} /> },
];

const SHARED_ITEMS: NavItem[] = [
  { label: 'Tournament Hub', path: '/admin/tournament-hub', icon: <FiAward size={18} /> },
  { label: 'Leaderboard', path: '/admin/leaderboard', icon: <FiTrendingUp size={18} /> },
  { label: 'Live Race View', path: '/admin/live-race', icon: <FiMonitor size={18} /> },
  { label: 'Notifications', path: '/admin/notifications', icon: <FiBell size={18} /> },
  { label: 'My Account', path: '/admin/my-account', icon: <FiUser size={18} /> },
];

interface AdminSidebarProps { collapsed?: boolean; }

const AdminSidebar = ({ collapsed = false }: AdminSidebarProps) => {
  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/admin'}
      className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
    >
      <span className={styles.navIcon}>{item.icon}</span>
      {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
    </NavLink>
  );

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <nav className={styles.nav}>
        {!collapsed && <span className={styles.groupLabel}>OPERATIONS</span>}
        <div className={styles.navGroup}>{OPERATIONS_ITEMS.map(renderItem)}</div>
        {!collapsed && <span className={styles.groupLabel}>SHARED</span>}
        <div className={styles.navGroup}>{SHARED_ITEMS.map(renderItem)}</div>
      </nav>
      <div className={styles.bottomBlock}>
        <button type="button" className={styles.collapseBtn}>
          <FiChevronLeft size={15} className={collapsed ? styles.flipped : ''} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
