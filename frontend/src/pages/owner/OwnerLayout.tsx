import { Outlet, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { apiFetch } from '../../services/apiClient'

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

export default function OwnerLayout() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="flex min-h-screen bg-gray-50">
<<<<<<< HEAD
<<<<<<< HEAD
      <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col">
        <h2 className="font-bold text-lg mb-4 text-gray-800">🐴 Chủ ngựa</h2>
=======
      <aside className="w-56 bg-white border-r border-gray-200 p-4">
        <h2 className="font-bold text-lg mb-6 text-gray-800">🐴 Owner</h2>
        <nav className="flex flex-col gap-2">
=======
      
>>>>>>> 78e4825 (Fix owner layout JSX)
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* ─── Thông tin chủ ngựa ─── */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
              {loading
                ? '…'
                : profile?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-800 text-sm leading-tight truncate">
                {loading ? 'Đang tải...' : (profile?.fullName ?? '—')}
              </p>
              <p className="text-xs text-blue-600 font-medium truncate">
                @{loading ? '...' : (profile?.username ?? '—')}
              </p>
            </div>
          </div>
>>>>>>> 67e988f (Fix owner layout conflict markers)

        <div className="mb-6">
          {loading ? (
            <div className="text-sm text-gray-500 animate-pulse">Đang tải thông tin...</div>
          ) : profile ? (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="font-bold text-blue-900 text-sm">{profile.fullName}</p>
              <p className="text-xs text-blue-700 truncate">{profile.email}</p>
              <p className="text-xs text-gray-500 mt-1">SĐT: {profile.profile?.phoneNumber}</p>
            </div>
<<<<<<< HEAD
          ) : (
            <div className="text-sm text-red-500">Không tải được Profile</div>
          )}
=======
            <div className="flex items-center gap-2">
              <span className="text-gray-400">📞</span>
              <span>{loading ? '...' : (profile?.profile?.phoneNumber ?? '—')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">🪪</span>
              <span className="truncate">{loading ? '...' : (profile?.profile?.identityNumber ?? '—')}</span>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  profile?.status === 'Active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
               > 
                {loading ? '...' : (profile?.status ?? '—')}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                {loading ? '...' : (profile?.role ?? '—')}
              </span>
            </div>
          </div>
>>>>>>> 67e988f (Fix owner layout conflict markers)
        </div>

        <nav className="flex flex-col gap-2">
          <NavLink
            to="/owner"
            end
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            Tổng quan
          </NavLink>

          <NavLink
            to="/owner/horses"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            🐴 Ngựa của tôi
          </NavLink>

          <NavLink
            to="/owner/horses/register"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            + Đăng ký ngựa
          </NavLink>

          <NavLink
            to="/owner/race-entries"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            🏁 Đăng ký cuộc đua
          </NavLink>

          <NavLink
            to="/owner/tournaments"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            🏆 Danh sách Giải đấu
          </NavLink>

          <NavLink
            to="/owner/jockey-invite"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            🤠 Mời Jockey
          </NavLink>

          <NavLink
            to="/owner/schedule-confirm"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            📅 Xác nhận lịch thi đấu
          </NavLink>

          <NavLink
            to="/owner/protest"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            ⚖️ Khiếu nại giải đấu
          </NavLink>
        </nav>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}