import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function JockeyDashboard() {
  const navigate = useNavigate();

  const statCards = [
    {
      title: 'Lời mời mới',
      value: '2',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: '📩',
      link: '/jockey/invitations',
    },
    {
      title: 'Cuộc đua sắp tới',
      value: '1',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: '🏃',
      link: '/jockey/races',
    },
    {
      title: 'Tổng số trận',
      value: '47',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: '🏅',
      link: '/jockey/history',
    },
    {
      title: 'Tỉ lệ thắng',
      value: '38%',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: '🏆',
      link: '/jockey/history',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Phần chào mừng */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Xin chào, Kỵ sĩ!
          </h1>
          <p className="text-gray-600 text-lg">
            Chào mừng bạn quay trở lại. Dưới đây là thông tin tổng quan về hoạt động của bạn.
          </p>
        </div>

        {/* Lưới thẻ thống kê */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, index) => (
            <button
              key={index}
              onClick={() => navigate(card.link)}
              className={`border-2 rounded-xl shadow-sm p-6 transition-all hover:shadow-md hover:scale-105 ${card.color}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">{card.title}</h3>
                <span className="text-3xl">{card.icon}</span>
              </div>
              <p className="text-4xl font-bold">{card.value}</p>
              <p className="text-xs font-medium mt-2 opacity-75">
                Nhấn để xem chi tiết
              </p>
            </button>
          ))}
        </div>

        {/* Hành động nhanh */}
        <div className="mt-12 bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Hành động nhanh</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/jockey/invitations')}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Xem lời mời mới
            </button>
            <button
              onClick={() => navigate('/jockey/races')}
              className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Xem cuộc đua sắp tới
            </button>
            <button
              onClick={() => navigate('/jockey/history')}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              Xem lịch sử thi đấu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
