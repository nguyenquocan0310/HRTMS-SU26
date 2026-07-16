import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useState, useEffect } from 'react'
import { getMyAccountProfile } from '../../services/accountService'
import { logout } from '../../services/authService'
import useAuthStore from '../../store/authStore'
import type { OwnerRoleProfile, UserProfile } from '../../types/account.types'
import NotificationBell from '../../components/notifications/NotificationBell'


type OwnerProfile = UserProfile<OwnerRoleProfile>

const navGroups = [
  {
    title: 'Workspace',
    items: [
      { to: '/owner', label: 'Tổng quan', end: true },
      { to: '/owner/horses', label: 'Ngựa của tôi', end: false },
      { to: '/owner/horses/register', label: 'Đăng ký hồ sơ ngựa', end: false },
      { to: '/owner/earnings', label: 'Thu nhập', end: false },
      { to: '/owner/profile', label: 'Hồ sơ tài khoản', end: false },
    ],
  },
  {
    title: 'Quản lý cuộc đua',
    items: [
      { to: '/owner/tournaments', label: 'Giải đấu', end: false },
      { to: '/owner/race-entries', label: 'Đăng ký cuộc đua', end: false },
      { to: '/owner/jockey-invite', label: 'Mời Jockey', end: false },
      { to: '/owner/protest', label: 'Khiếu nại', end: false },
    ],
  },
]

const navItems = navGroups.flatMap((group) => group.items)

const isNavItemActive = (pathname: string, item: (typeof navItems)[number]) => {
  if (item.to === '/owner') return pathname === '/owner'
  if (item.to === '/owner/horses') {
    return pathname === '/owner/horses' || (
      pathname.startsWith('/owner/horses/') && !pathname.startsWith('/owner/horses/register')
    )
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

const EGG_STYLE_ID = 'logout-egg-style'
function ensureEggStyle() {
  if (document.getElementById(EGG_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = EGG_STYLE_ID
  style.textContent = `
    @keyframes logoutEggRise {
      0% { opacity: 0; transform: translateY(0px); }
      15% { opacity: 1; }
      75% { opacity: 1; transform: translateY(-28px); }
      100% { opacity: 0; transform: translateY(-36px); }
    }
    .logout-egg {
      animation: logoutEggRise 1.6s ease-out forwards;
      pointer-events: none;
      user-select: none;
    }
  `
  document.head.appendChild(style)
}

export default function OwnerLayout() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutEgg, setShowLogoutEgg] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await getMyAccountProfile())
    } catch {
      // Sidebar still renders navigation if profile loading fails.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfile()

    const handleProfileChanged = () => {
      void loadProfile()
    }
    window.addEventListener('hrtms:profile-changed', handleProfileChanged)
    return () => window.removeEventListener('hrtms:profile-changed', handleProfileChanged)
  }, [loadProfile])

  useEffect(() => {
    ensureEggStyle()
  }, [])

  const currentNav = navItems.find((item) => {
    if (item.end) return location.pathname === item.to
    return location.pathname.startsWith(item.to)
  })
  const pageTitle = location.pathname === '/owner/notifications'
    ? 'Thông báo'
    : currentNav?.label ?? 'Tổng quan'

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setShowLogoutEgg(true)

    try {
      await logout()
    } finally {
      clearAuth()
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('authReason')

      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 700)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#f7f9fc] text-slate-950">
      <aside className="w-full lg:w-[280px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="px-6 py-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-black shadow-sm shadow-blue-600/20">
              H
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-slate-950">HRTMS</p>
              <p className="text-xs font-medium text-slate-500">Owner Workspace</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-b border-slate-100">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ) : profile ? (
            <div>
              <p className="text-sm font-bold text-slate-950 truncate">{profile.fullName}</p>
              <p className="text-xs text-slate-500 truncate mt-1">{profile.email}</p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="inline-flex px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                  Chủ ngựa
                </span>
                {profile.status && (
                  <span className="inline-flex px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                    {profile.status}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-red-500">Không tải được thông tin</p>
          )}
        </div>

        <nav className="flex-1 py-5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="px-6 pb-2 text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em]">
                {group.title}
              </p>
              <ul className="space-y-1 px-3">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={() =>
                        `flex items-center px-4 py-3 text-sm rounded-xl transition-colors ${
                          isNavItemActive(location.pathname, item)
                            ? 'bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-100'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 font-semibold'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-5 py-5 border-t border-slate-100 space-y-3">
          <div className="relative">
            {showLogoutEgg && (
              <span className="logout-egg absolute left-1/2 -translate-x-1/2 bottom-full mb-1 text-xs font-medium text-slate-500 whitespace-nowrap">
                Hẹn gặp lại ở đường đua tiếp theo
              </span>
            )}

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full px-4 py-3 text-sm font-bold text-slate-700 border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="bg-white/90 backdrop-blur border-b border-slate-200 px-4 lg:px-8 py-4 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Chủ ngựa</span>
            <span className="text-sm text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/owner/horses/register')}
              className="hidden sm:inline-flex rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Tạo hồ sơ ngựa
            </button>
            <NotificationBell notificationsPath="/owner/notifications" />
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 lg:px-8 py-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
