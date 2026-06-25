import { useState, useRef, useEffect } from 'react';
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
import { logout } from '../services/authService'; 
import styles from './AdminLayout.module.scss';

const AdminLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, clearAuth } = useAuthStore();

  const currentUser = {
    name: user?.fullName ?? 'Admin User',
    role: user?.role ?? 'Administrator',
  };

  const unreadNotifications = 3;

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAuth();
      setLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className={styles.layout}>
      {/* ═══ TOPBAR ═══════════════════════════════════════════ */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
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

          <div className={styles.accountWrap} ref={menuRef}>
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
                <button
                  type="button"
                  className={styles.accountMenuItem}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    navigate('/admin/my-account'); // chỉnh route nếu khác
                  }}
                >
                  <FiUser size={15} />
                  My Account
                </button>
                <button
                  type="button"
                  className={styles.accountMenuItem}
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <FiLogOut size={15} />
                  {loggingOut ? 'Đang đăng xuất...' : 'Logout'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══ BODY ═════════════════════════════════════════════ */}
      <div className={styles.body}>
        <div className={styles.sidebarDesktop}>
          <AdminSidebar collapsed={sidebarCollapsed} />
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

        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setSidebarCollapsed((v) => !v)}
          aria-label="Toggle sidebar width"
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;