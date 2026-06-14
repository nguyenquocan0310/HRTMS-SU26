import { Outlet, NavLink } from 'react-router-dom'

export default function OwnerLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 p-4">
        <h2 className="font-bold text-lg mb-6 text-gray-800">🐴 Owner</h2>
        <nav className="flex flex-col gap-2">
          <NavLink to="/owner" end
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }>
            Dashboard
          </NavLink>
          <NavLink to="/owner/horses"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }>
            🐴 Ngựa của tôi
          </NavLink>
          <NavLink to="/owner/horses/register"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }>
            + Đăng ký ngựa
          </NavLink>

          {/* ─── HAI MENU MỚI ĐƯỢC THÊM VÀO ĐÂY ─── */}
          <NavLink to="/owner/race-entries"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }>
            🏁 Đăng ký cuộc đua
          </NavLink>
          <NavLink to="/owner/jockey-invite"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }>
            🤠 Mời Jockey
          </NavLink>
          
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}