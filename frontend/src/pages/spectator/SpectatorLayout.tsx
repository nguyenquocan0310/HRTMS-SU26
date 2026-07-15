import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import NotificationBell from '../../components/notifications/NotificationBell'

export default function SpectatorLayout() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      {/* Thanh Sidebar cố định bên trái */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between h-full shadow-sm select-none">
        {/* Phần trên: Tiêu đề & Menu điều hướng */}
        <div>
          {/* Tiêu đề & Phụ đề */}
          <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-amber-50/40 via-transparent to-transparent">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>💰</span> Khán giả giải đua
            </h1>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mt-1">
              Theo dõi & Dự đoán
            </p>
          </div>

          {/* Menu điều hướng */}
          <nav className="p-4 space-y-1">
            <NavLink
              to="/spectator"
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-100 text-amber-800 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-lg">🏠</span>
              <span>Trang chủ giải đua</span>
            </NavLink>

            <NavLink
              to="/spectator/prediction"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-100 text-amber-800 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-lg">🔮</span>
              <span>Sảnh dự đoán</span>
            </NavLink>

            <NavLink
              to="/spectator/wallet"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-100 text-amber-800 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-lg">💳</span>
              <span>Ví điểm cá nhân</span>
            </NavLink>

            <NavLink
              to="/spectator/my-predictions"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-100 text-amber-800 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-lg">📋</span>
              <span>Lịch sử dự đoán</span>
            </NavLink>

            <NavLink
              to="/spectator/leaderboard"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-100 text-amber-800 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-lg">🏆</span>
              <span>Bảng xếp hạng</span>
            </NavLink>

          </nav>
        </div>

        {/* Phần dưới: Nút Đăng xuất */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/55">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            <span className="text-lg">🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Vùng không gian chính bên phải hiển thị Outlet */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Khán giả</p>
            <p className="text-sm font-semibold text-gray-800">Theo dõi &amp; dự đoán</p>
          </div>
          <NotificationBell notificationsPath="/spectator/notifications" />
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
