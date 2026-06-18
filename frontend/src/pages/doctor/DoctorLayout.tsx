import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

export default function DoctorLayout() {
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar cố định bên trái */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-screen z-10">
        {/* Header của Sidebar */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <div>
              <h2 className="font-bold text-lg text-gray-800 leading-tight">Bác sĩ thú y</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Hệ thống Y tế & Sức khỏe</p>
            </div>
          </div>
        </div>

        {/* Các liên kết Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <NavLink
            to="/doctor"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
              }`
            }
          >
            <span className="text-lg">📊</span>
            <span>Tổng quan</span>
          </NavLink>

          <NavLink
            to="/doctor/paddock"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700 font-semibold shadow-sm shadow-emerald-100/50'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
              }`
            }
          >
            <span className="text-lg">⏱️</span>
            <span>Bảng điều khiển Paddock</span>
          </NavLink>
        </nav>

        {/* Nút Đăng xuất ở chân Sidebar */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            <span className="text-lg">🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Vùng nội dung chính bên phải */}
      <div className="flex-1 pl-64 flex flex-col min-h-screen">
        <main className="flex-grow p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
