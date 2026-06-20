import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  FiSearch,
  FiBell,
  FiHelpCircle,
  FiMenu,
  FiX,
  FiUser,
  FiLogOut,
} from 'react-icons/fi';
import AdminSidebar from '../components/admin/AdminSidebar';
import styles from './AdminLayout.module.scss';

const AdminLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // TODO: lấy từ authStore thật khi có BE — Điều 6
  const currentUser = {
    name: 'Admin User',
    role: 'Administrator',
  };

  const unreadNotifications = 3;

  return (
    <div className={styles.layout}>
      {/* ═══ TOPBAR ═══════════════════════════════════════════ */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          {/* Hamburger — chỉ hiện mobile */}
          <button
            type="button"
            className={styles.hamburgerBtn}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle sidebar"
          >
            {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>

          <span className={styles.logo}>HRTMS</span>

          <div className={styles.searchWrap}>
            <FiSearch className={styles.searchIcon} size={16} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Global system search..."
            />
          </div>
        </div>

        <div className={styles.topbarRight}>
          <button type="button" className={styles.iconBtn} aria-label="Notifications">
            <FiBell size={18} />
            {unreadNotifications > 0 && (
              <span className={styles.badge}>{unreadNotifications}</span>
            )}
          </button>

          <button type="button" className={styles.iconBtn} aria-label="Help">
            <FiHelpCircle size={18} />
          </button>

          <div className={styles.accountWrap}>
            <button
              type="button"
              className={styles.accountBtn}
              onClick={() => setAccountMenuOpen((v) => !v)}
            >
              <div className={styles.avatar}>
                {currentUser.name.charAt(0)}
              </div>
              <div className={styles.accountInfo}>
                <span className={styles.accountName}>{currentUser.name}</span>
                <span className={styles.accountRole}>{currentUser.role}</span>
              </div>
            </button>

            {accountMenuOpen && (
              <div className={styles.accountMenu}>
                <button type="button" className={styles.accountMenuItem}>
                  <FiUser size={15} />
                  My Account
                </button>
                <button type="button" className={styles.accountMenuItem}>
                  <FiLogOut size={15} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══ BODY ═════════════════════════════════════════════ */}
      <div className={styles.body}>
        {/* Sidebar desktop/tablet */}
        <div className={styles.sidebarDesktop}>
          <AdminSidebar collapsed={sidebarCollapsed} />
        </div>

        {/* Sidebar mobile overlay */}
        {mobileOpen && (
          <>
            <div
              className={styles.mobileOverlay}
              onClick={() => setMobileOpen(false)}
            />
            <div className={styles.sidebarMobile}>
              <AdminSidebar />
            </div>
          </>
        )}

        {/* Collapse toggle (desktop) */}
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setSidebarCollapsed((v) => !v)}
          aria-label="Toggle sidebar width"
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {/* Main content */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;