import React from 'react'
import { useNavigate } from 'react-router-dom'

interface RaceMock {
  id: string
  name: string
  tournament: string
  startTime: string
  horseCount: number
  prizePool: string
}

interface HorseLeaderboard {
  rank: number
  medal: string
  name: string
  points: number
  winRate: string
}

export default function SpectatorHome() {
  const navigate = useNavigate()

  const upcomingRaces: RaceMock[] = [
    {
      id: 'race-01',
      name: 'Lượt 2 - Giải Vô Địch Quốc Gia',
      tournament: 'Vô Địch Quốc Gia 2026',
      startTime: '18/06/2026 14:30',
      horseCount: 8,
      prizePool: '5,000 điểm',
    },
    {
      id: 'race-02',
      name: 'Lượt 3 - Cúp Tốc Độ Hà Nội',
      tournament: 'Cúp Tốc Độ Hà Nội 2026',
      startTime: '18/06/2026 16:00',
      horseCount: 6,
      prizePool: '8,000 điểm',
    },
    {
      id: 'race-03',
      name: 'Trận Chung Kết - Derby Mùa Hè',
      tournament: 'Derby Mùa Hè 2026',
      startTime: '19/06/2026 09:30',
      horseCount: 10,
      prizePool: '15,000 điểm',
    },
  ]

  const topHorses: HorseLeaderboard[] = [
    {
      rank: 1,
      medal: '🥇',
      name: 'Thần Phong',
      points: 1250,
      winRate: '85%',
    },
    {
      rank: 2,
      medal: '🥈',
      name: 'Xích Thố',
      points: 1100,
      winRate: '75%',
    },
    {
      rank: 3,
      medal: '🥉',
      name: 'Hắc Nhãn',
      points: 950,
      winRate: '68%',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Phần đầu: Tiêu đề chào mừng khán giả hoành tráng */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight bg-gradient-to-r from-amber-600 to-amber-900 bg-clip-text text-transparent">
            Chào mừng Khán giả đến với Đấu trường
          </h1>
          <p className="text-gray-500 mt-1.5 text-sm md:text-base">
            Theo dõi những màn so tài tốc độ đỉnh cao và đưa ra các dự đoán chuẩn xác để tích lũy điểm thưởng!
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm w-fit">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span className="font-semibold text-gray-700">Mùa giải Đua ngựa 2026</span>
        </div>
      </div>

      {/* Hệ thống 3 thẻ chỉ số (Stats Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Thẻ 1: Cuộc đua hôm nay */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-500">Cuộc đua hôm nay</span>
            <div className="mt-2 text-3xl font-extrabold text-gray-900">3</div>
          </div>
          <div className="text-3xl bg-amber-50 p-3 rounded-2xl text-amber-600">
            🏇
          </div>
        </div>

        {/* Thẻ 2: Số dư ví điểm */}
        <button
          onClick={() => navigate('/spectator/wallet')}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-300 flex items-center justify-between text-left group cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <div>
            <span className="text-sm font-semibold text-gray-500 group-hover:text-amber-700 transition-colors">
              Số dư ví điểm
            </span>
            <div className="mt-2 text-3xl font-extrabold text-amber-600 group-hover:scale-105 transition-transform duration-300 origin-left">
              850 điểm
            </div>
          </div>
          <div className="text-3xl bg-amber-50 group-hover:bg-amber-100 p-3 rounded-2xl text-amber-600 transition-colors">
            💳
          </div>
        </button>

        {/* Thẻ 3: Tỉ lệ dự đoán đúng */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-500">Tỉ lệ dự đoán đúng</span>
            <div className="mt-2 text-3xl font-extrabold text-emerald-600">
              12/20 trận
            </div>
          </div>
          <div className="text-3xl bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            🎯
          </div>
        </div>
      </div>

      {/* Khu vực "Danh sách cuộc đua sắp diễn ra" */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          🏁 Danh sách cuộc đua sắp diễn ra
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {upcomingRaces.map((race) => (
            <div
              key={race.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden"
            >
              <div className="p-6 space-y-4">
                {/* Giải đấu tag */}
                <span className="inline-block px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full">
                  {race.tournament}
                </span>
                {/* Tên cuộc đua */}
                <h3 className="text-lg font-bold text-gray-900 leading-snug">
                  {race.name}
                </h3>
                
                {/* Chi tiết cuộc đua */}
                <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">Khởi tranh:</span>
                    <span className="font-semibold text-gray-800">{race.startTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">Chiến mã:</span>
                    <span className="font-semibold text-gray-800">{race.horseCount} ngựa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">Quỹ thưởng:</span>
                    <span className="font-bold text-amber-600">{race.prizePool}</span>
                  </div>
                </div>
              </div>

              {/* Nút Xem & Đặt dự đoán */}
              <div className="px-6 pb-6 pt-2">
                <button
                  onClick={() => navigate('/spectator/prediction')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all duration-150 active:scale-[0.98] shadow-sm hover:shadow"
                >
                  Xem & Đặt dự đoán
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Khu vực "Bảng xếp hạng chiến mã nhanh nhất" */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          🏆 Bảng xếp hạng chiến mã nhanh nhất
        </h2>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3 px-6 text-center w-24">Thứ hạng</th>
                  <th className="py-3 px-6">Chiến mã</th>
                  <th className="py-3 px-6 text-right">Tích lũy</th>
                  <th className="py-3 px-6 text-right pr-8">Tỷ lệ thắng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {topHorses.map((horse) => (
                  <tr
                    key={horse.rank}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-4 px-6 text-center text-xl font-bold">
                      {horse.medal}
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-950 flex items-center gap-2">
                        <span>🐴</span>
                        {horse.name}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-gray-700">
                      {horse.points.toLocaleString('vi-VN')} điểm
                    </td>
                    <td className="py-4 px-6 text-right pr-8 font-bold text-emerald-600">
                      {horse.winRate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
