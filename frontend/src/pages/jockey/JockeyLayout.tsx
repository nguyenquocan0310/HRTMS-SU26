import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';

export default function JockeyLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 shadow-sm relative">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">🏇 Jockey</h1>
          <p className="text-sm text-gray-600 mt-1">Quản lý sự nghiệp</p>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-2">
          <NavLink
            to="/jockey"
            end
            className={({ isActive }) =>
              `block px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            Tổng quan
          </NavLink>

          <NavLink
            to="/jockey/invitations"
            className={({ isActive }) =>
              `block px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            Lời mời tham gia
          </NavLink>

          <NavLink
            to="/jockey/races"
            className={({ isActive }) =>
              `block px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            Cuộc đua của tôi
          </NavLink>

          <NavLink
            to="/jockey/tournaments"
            className={({ isActive }) =>
              `block px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            🏆 Đăng ký giải đấu
          </NavLink>

          <NavLink
            to="/jockey/history"
            className={({ isActive }) =>
              `block px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            Lịch sử thi đấu
          </NavLink>

          {/* ─── ✨ ĐÃ BỔ SUNG 2 MENU MỚI KHỚP VỚI ĐƯỜNG DẪN APP.TSX ─── */}
          <NavLink
            to="/jockey/profile-declaration"
            className={({ isActive }) =>
              `block px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            👤 Thông tin kỵ sĩ
          </NavLink>

          <NavLink
            to="/jockey/protest"
            className={({ isActive }) =>
              `block px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            ⚖️ Khiếu nại giải đấu
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-gray-200 bg-white">
          <button className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}