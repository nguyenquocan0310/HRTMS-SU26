import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
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
import useAuthStore from '../store/authStore';
import { logout as logoutApi } from '../services/authService';
import { getUnreadNotificationCount, NOTIFICATIONS_CHANGED_EVENT } from '../services/notificationService';
import styles from './AdminLayout.module.scss';

const AdminLayout = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const currentUser = {
    name: user?.fullName || 'Quản trị viên',
    role: user?.role || 'Admin',
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutApi();
    clearAuth();
    navigate('/login', { replace: true });
  };

  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let active = true;
    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationCount();
        if (active) setUnreadNotifications(count);
      } catch {
        if (active) setUnreadNotifications(0);
      }
    };
    void loadUnreadCount();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, loadUnreadCount);
    const timer = window.setInterval(() => void loadUnreadCount(), 45_000);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, loadUnreadCount);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className={styles.layout}>
      {/* ═══ TOPBAR ═══════════════════════════════════════════ */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <button
            type="button"
            className={styles.hamburgerBtn}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Mở hoặc đóng thanh điều hướng"
          >
            {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>

          <div className={styles.logoBlock}>
            <div className={styles.logoIconSmall}>H</div>
            <div className={styles.logoTextBlock}>
              <span className={styles.logo}>HRTMS</span>
            </div>
          </div>

          <div className={styles.workspaceLabel}>
            <span className={styles.workspaceName}>Không gian quản trị</span>
          </div>

          <div className={styles.searchWrap}>
            <FiSearch className={styles.searchIcon} size={16} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Tìm giải đấu, ngựa, người dùng"
            />
          </div>
        </div>

        <div className={styles.topbarRight}>
          <button type="button" className={styles.iconBtn} aria-label="Thông báo" onClick={() => navigate('/admin/notifications')}>
            <FiBell size={18} />
            {unreadNotifications > 0 && (
              <span className={styles.badge}>{unreadNotifications}</span>
            )}
          </button>

          <button type="button" className={styles.iconBtn} aria-label="Trợ giúp">
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
                <button type="button" className={styles.accountMenuItem} onClick={() => navigate('/admin/my-account')}>
                  <FiUser size={15} />
                  Tài khoản của tôi
                </button>
                <button
                  type="button"
                  className={styles.accountMenuItem}
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <FiLogOut size={15} />
                  {loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                </button>
              </div>
            )}
          </div>

          <button type="button" className={styles.logoutBtn} onClick={handleLogout} aria-label="Đăng xuất" disabled={loggingOut}>
            <FiLogOut size={18} />
          </button>
        </div>
      </header>

      {/* ═══ BODY ═════════════════════════════════════════════ */}
      <div className={styles.body}>
        <div className={styles.sidebarDesktop}>
          <AdminSidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} />
        </div>

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

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
