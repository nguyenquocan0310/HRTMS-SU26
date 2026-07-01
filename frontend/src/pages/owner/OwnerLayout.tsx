import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { apiFetch } from '../../services/apiClient'
import { logout } from '../../services/authService'
import useAuthStore from '../../store/authStore'

interface OwnerProfile {
  userId: number
  username: string
  fullName: string
  email: string
  role: string
  status: string
  profile: {
    phoneNumber: string
    identityNumber: string
  }
}

interface ProfileApiResponse {
  success: boolean
  message: string
  data: OwnerProfile | null
}

const navItems = [
  { to: '/owner', label: 'Tổng quan', end: true },
  { to: '/owner/horses', label: 'Ngựa của tôi', end: false },
  { to: '/owner/horses/register', label: 'Đăng ký ngựa mới', end: false },
  { to: '/owner/race-entries', label: 'Đăng ký cuộc đua', end: false },
  { to: '/owner/tournaments', label: 'Danh sách giải đấu', end: false },
  { to: '/owner/jockey-invite', label: 'Mời Jockey', end: false },
  { to: '/owner/protest', label: 'Khiếu nại giải đấu', end: false },
]

// ── Easter egg keyframes injected once into <head> ───────────────────────────
const EGG_STYLE_ID = 'logout-egg-style'
function ensureEggStyle() {
  if (document.getElementById(EGG_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = EGG_STYLE_ID
  style.textContent = `
    @keyframes logoutEggRise {
      0%   { opacity: 0; transform: translateY(0px); }
      15%  { opacity: 1; }
      75%  { opacity: 1; transform: translateY(-28px); }
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

  useEffect(() => {
    apiFetch<ProfileApiResponse>('/auth/profile')
      .then((res) => {
        if (res.success && res.data) {
          setProfile(res.data)
        }
      })
      .catch(() => {
        // Bỏ qua lỗi, sidebar vẫn render nav bình thường
      })
      .finally(() => setLoading(false))
  }, [])

  // Ensure CSS keyframes exist in DOM
  useEffect(() => { ensureEggStyle() }, [])

  // Determine current page title for the top bar
  const currentNav = navItems.find((item) => {
    if (item.end) return location.pathname === item.to
    return location.pathname.startsWith(item.to)
  })
  const pageTitle = currentNav?.label ?? 'Tổng quan'

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)

    // Show Easter egg immediately
    setShowLogoutEgg(true)

    try {
      // POST /api/auth/logout — best-effort, error is swallowed inside logout()
      await logout()
    } finally {
      // Always clear auth state regardless of API result
      clearAuth()
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('authReason')

      // Short delay so the Easter egg is visible, then redirect
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 700)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Logo / System title */}
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">HRTMS</p>
          <p className="text-sm font-bold text-gray-800 mt-0.5">Cổng chủ ngựa</p>
        </div>

        {/* Profile block */}
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
                  Chủ ngựa
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

        {/* Navigation */}
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

        {/* Footer — logout button + copyright */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {/* Logout button — positioned relative so the Easter egg floats above it */}
          <div className="relative">
            {/* Easter egg: floating farewell text */}
            {showLogoutEgg && (
              <span
                className="logout-egg absolute left-1/2 -translate-x-1/2 bottom-full mb-1 text-xs font-medium text-gray-500 whitespace-nowrap"
              >
                Hẹn gặp lại ở đường đua tiếp theo 🏇
              </span>
            )}

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">Horse Racing TMS &copy; 2026</p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">Chủ ngựa</span>
          <span className="text-xs text-gray-300">/</span>
          <span className="text-xs font-semibold text-gray-700">{pageTitle}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}