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
      <aside className="w-56 bg-white border-r border-gray-200 p-4 flex flex-col">
        <h2 className="font-bold text-lg mb-4 text-gray-800">🐴 Chủ ngựa</h2>

        <div className="mb-6">
          {loading ? (
            <div className="text-sm text-gray-500 animate-pulse">Đang tải thông tin...</div>
          ) : profile ? (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="font-bold text-blue-900 text-sm">{profile.fullName}</p>
              <p className="text-xs text-blue-700 truncate">{profile.email}</p>
              <p className="text-xs text-gray-500 mt-1">SĐT: {profile.profile?.phoneNumber}</p>
            </div>
          ) : (
            <div className="text-sm text-red-500">Không tải được Profile</div>
          )}
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