import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { logout } from '../../services/authService';
import { getMyAccountProfile } from '../../services/accountService';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../../components/notifications/NotificationBell';
import type { JockeyRoleProfile, UserProfile } from '../../types/account.types';

type JockeyAccountProfile = UserProfile<JockeyRoleProfile>;

const navItems = [
  { to: '/jockey', label: 'Tổng quan', end: true },
  { to: '/jockey/invitations', label: 'Lời mời tham gia', end: false },
  { to: '/jockey/races', label: 'Cuộc đua của tôi', end: false },
  { to: '/jockey/tournaments', label: 'Đăng ký giải đấu', end: false },
  { to: '/jockey/history', label: 'Lịch sử thi đấu', end: false },
  { to: '/jockey/profile-declaration', label: 'Thông tin kỵ sĩ', end: false },
  { to: '/jockey/protest', label: 'Khiếu nại giải đấu', end: false },
  { to: '/jockey/notifications', label: 'Thông báo', end: false },
];

export default function JockeyLayout() {
  const [profile, setProfile] = useState<JockeyAccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const loadProfile = useCallback(() => {
    return getMyAccountProfile<JockeyRoleProfile>()
      .then(setProfile)
      .catch(() => {
        // Sidebar still renders navigation if profile cannot be loaded.
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadProfile();
    const handleProfileChanged = () => { void loadProfile(); };
    window.addEventListener('hrtms:profile-changed', handleProfileChanged);
    return () => window.removeEventListener('hrtms:profile-changed', handleProfileChanged);
  }, [loadProfile]);

  const currentNav = navItems.find((item) => {
    if (item.end) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  });
  const pageTitle = currentNav?.label ?? 'Tổng quan';

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      clearAuth();
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('authReason');
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">HRTMS</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">Cổng kỵ sĩ</p>
        </div>

        <div className="px-4 py-4 border-b border-gray-100">
          {loading ? (
            <div className="space-y-1.5 animate-pulse">
              <div className="h-3.5 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ) : profile ? (
            <div>
              <p className="text-sm font-semibold text-gray-800 truncate">{profile.fullName}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{profile.email}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded border border-blue-100">
                  Kỵ sĩ
                </span>
                {profile.status && (
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded border border-green-100">
                    {profile.status}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-red-500">Không tải được thông tin</p>
          )}
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          <p className="px-5 pt-2 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Quản lý
          </p>
          <ul className="space-y-0.5 px-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 rounded-l-none pl-[10px]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium border-l-2 border-transparent rounded-l-none pl-[10px]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
          <p className="text-xs text-gray-400 text-center">Horse Racing TMS &copy; 2026</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Kỵ sĩ</span>
            <span className="text-xs text-gray-300">/</span>
            <span className="text-xs font-semibold text-gray-700">{pageTitle}</span>
          </div>
          <NotificationBell notificationsPath="/jockey/notifications" />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
