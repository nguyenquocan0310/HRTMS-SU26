import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiClient';
import { logout } from '../../services/authService';
import { getRefereeProfile, type RefereeProfile } from '../../services/refereeService';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../../components/notifications/NotificationBell';

interface RefereeAuthProfile {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

interface ProfileApiResponse {
  success: boolean;
  message: string;
  data: RefereeAuthProfile | null;
}

const navItems = [
  { to: '/referee', label: 'Tổng quan', end: true },
  { to: '/referee/tournaments', label: 'Đăng ký giải đấu', end: false },
  { to: '/referee/coi', label: 'Khai báo COI', end: false },
  { to: '/referee/race-console', label: 'Race Console', end: false },
];

export default function RefereeLayout() {
  const [profile, setProfile] = useState<RefereeAuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    const normalizeProfile = (
      data: RefereeProfile | RefereeAuthProfile | null | undefined
    ): RefereeAuthProfile | null => {
      if (!data) return null;
      return {
        userId: 'userId' in data ? data.userId : data.refereeId,
        username: data.username,
        fullName: data.fullName,
        email: data.email,
        role: 'role' in data ? data.role : 'Referee',
        status: data.status,
      };
    };

    const loadProfile = async () => {
      try {
        const refereeProfile = await getRefereeProfile();
        setProfile(normalizeProfile(refereeProfile));
      } catch {
        try {
          const fallback = await apiFetch<ProfileApiResponse | RefereeAuthProfile>('/auth/profile');
          const fallbackData =
            fallback && typeof fallback === 'object' && 'data' in fallback
              ? fallback.data
              : fallback;
          setProfile(normalizeProfile(fallbackData));
        } catch {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile().catch(() => {
        // Vẫn render navigation nếu profile không tải được.
        setProfile(null);
        setLoading(false);
      });
  }, []);

  const currentNav = navItems.find((item) => {
    if (item.end) return location.pathname === item.to;
    return location.pathname.startsWith(item.to);
  });
  const pageTitle = location.pathname === '/referee/notifications'
    ? 'Thông báo'
    : currentNav?.label ?? 'Tổng quan';

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
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">HRTMS</p>
          <p className="mt-0.5 text-sm font-bold text-gray-800">Cổng trọng tài</p>
        </div>

        <div className="border-b border-gray-100 px-4 py-4">
          {loading ? (
            <div className="space-y-1.5 animate-pulse">
              <div className="h-3.5 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          ) : profile ? (
            <div>
              <p className="truncate text-sm font-semibold text-gray-800">{profile.fullName}</p>
              <p className="mt-0.5 truncate text-xs text-gray-400">{profile.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Trọng tài
                </span>
                {profile.status && (
                  <span className="inline-flex rounded border border-green-100 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    {profile.status}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Thông tin tài khoản chưa sẵn sàng</p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <p className="px-5 pb-1.5 pt-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Quản lý
          </p>
          <ul className="space-y-0.5 px-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center rounded-md border-l-2 px-3 py-2 pl-[10px] text-sm transition-colors ${
                      isActive
                        ? 'rounded-l-none border-blue-600 bg-blue-50 font-semibold text-blue-700'
                        : 'rounded-l-none border-transparent font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-2 border-t border-gray-100 px-4 py-3">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
          <p className="text-center text-xs text-gray-400">Horse Racing TMS &copy; 2026</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs text-gray-400">Trọng tài</span>
            <span className="text-xs text-gray-300">/</span>
            <span className="truncate text-xs font-semibold text-gray-700">{pageTitle}</span>
          </div>
          <NotificationBell notificationsPath="/referee/notifications" />
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
