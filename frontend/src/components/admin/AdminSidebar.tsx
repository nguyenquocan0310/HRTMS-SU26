import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FiHome,
  FiFlag,
  FiUsers,
  FiDollarSign,
  FiTrendingUp,
  FiSettings,
  FiLogOut,
  FiChevronDown,
  FiZap,
} from 'react-icons/fi';
import { GiHorseHead } from 'react-icons/gi';
import styles from './AdminSidebar.module.scss';

interface NavChild {
  label: string;
  path: string;
}

interface NavGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  children: NavChild[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Tổng quan',
    icon: <FiHome size={18} />,
    children: [
      { label: 'Admin Dashboard', path: '/admin' },
    ],
  },
  {
    key: 'tournament',
    label: 'Vận hành Giải đấu',
    icon: <FiFlag size={18} />,
    children: [
      { label: 'Tournament Builder', path: '/admin/tournaments' },
      { label: 'Assignment Center', path: '/admin/assignments' },
      { label: 'Declare Official Console', path: '/admin/declare-official' },
    ],
  },
  {
    key: 'users',
    label: 'Người dùng & Duyệt hồ sơ',
    icon: <FiUsers size={18} />,
    children: [
      { label: 'Approval Center', path: '/admin/approvals' },
      { label: 'User Management', path: '/admin/users' },
    ],
  },
  {
    key: 'finance',
    label: 'Tài chính',
    icon: <FiDollarSign size={18} />,
    children: [
      { label: 'Entry Fee Management', path: '/admin/entry-fees' },
      { label: 'Purse & Payout Management', path: '/admin/payouts' },
    ],
  },
  {
    key: 'engagement',
    label: 'Tương tác',
    icon: <FiTrendingUp size={18} />,
    children: [
      { label: 'Prediction Gate & Reward Config', path: '/admin/prediction-config' },
    ],
  },
  {
    key: 'system',
    label: 'Hệ thống',
    icon: <FiSettings size={18} />,
    children: [
      { label: 'Audit Log Viewer', path: '/admin/audit-log' },
      { label: 'Reports & Export', path: '/admin/reports' },
    ],
  },
];

interface AdminSidebarProps {
  collapsed?: boolean;
}

const AdminSidebar = ({ collapsed = false }: AdminSidebarProps) => {
  // Mặc định mở nhóm đầu tiên
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logoBlock}>
        <div className={styles.logoIcon}>
          <GiHorseHead />
        </div>
        {!collapsed && (
          <div className={styles.logoText}>
            <span className={styles.logoMain}>HRTMS</span>
            <span className={styles.logoSub}>MANAGEMENT SYSTEM</span>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className={styles.nav}>
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className={styles.navGroup}>
            <button
              type="button"
              className={styles.navGroupHeader}
              onClick={() => toggleGroup(group.key)}
            >
              <span className={styles.navGroupIcon}>{group.icon}</span>
              {!collapsed && (
                <>
                  <span className={styles.navGroupLabel}>{group.label}</span>
                  <FiChevronDown
                    size={14}
                    className={`${styles.chevron} ${
                      openGroups[group.key] ? styles.chevronOpen : ''
                    }`}
                  />
                </>
              )}
            </button>

            {!collapsed && openGroups[group.key] && (
              <div className={styles.navChildren}>
                {group.children.map((child) => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    end={child.path === '/admin'}
                    className={({ isActive }) =>
                      `${styles.navChild} ${isActive ? styles.navChildActive : ''}`
                    }
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className={styles.bottomBlock}>
        <button type="button" className={styles.quickActionBtn}>
          <FiZap size={16} />
          {!collapsed && <span>Quick Action</span>}
        </button>

        <NavLink
          to="/admin/settings"
          className={({ isActive }) =>
            `${styles.bottomLink} ${isActive ? styles.bottomLinkActive : ''}`
          }
        >
          <FiSettings size={16} />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button type="button" className={styles.bottomLink}>
          <FiLogOut size={16} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;