import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

// Lấy URL cấu hình từ file .env.local (mặc định trỏ sang http://localhost:5222 nếu lỗi)
const API_BASE_URL = 'http://localhost:5222';
interface RaceReal {
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
  const [upcomingRaces, setUpcomingRaces] = useState<RaceReal[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // ── HOOK GỌI API THỰC TẾ TỪ BACKEND (.NET) ──
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoading(true)
        // Gọi đến endpoint GET /api/tournament mà bạn thấy trên Swagger
        const response = await axios.get(`${API_BASE_URL}/api/tournament`)
        
        // Đấu nối và chuẩn hóa dữ liệu từ DB trả về để khớp với giao diện UI
        const responseData = response.data.success ? response.data.data : [];
// Phòng trường hợp Back-end trả về một object đơn lẻ hoặc mảng, ta ép kiểu để map
const dataArray = Array.isArray(responseData) ? responseData : [responseData];

const mappedRaces = dataArray.map((item: any) => ({
  id: item.tournamentId || `race-${Math.random()}`,
  name: item.name || 'Lượt Đua Giải Đấu Mới',
  tournament: item.name || 'Giải Đua Ngựa HRTMS',
  startTime: item.startDate 
    ? new Date(item.startDate).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) 
    : 'Đang cập nhật',
  horseCount: item.maxHorses || 8, 
  prizePool: '10,000 điểm',
}))
        setUpcomingRaces(mappedRaces)
        setError(null)
      } catch (err: any) {
        console.error('Lỗi khi gọi API Tournament:', err)
        setError('Không thể kết nối đến máy chủ dữ liệu giải đấu.')
      } finally {
        setLoading(false)
      }
    }

    fetchTournaments()
  }, [])

  // Giữ lại bảng xếp hạng Mock vì DB chặng này chưa xử lý xong bảng điểm tổng
  const topHorses: HorseLeaderboard[] = [
    { rank: 1, medal: '🥇', name: 'Thần Phong', points: 1250, winRate: '85%' },
    { rank: 2, medal: '🥈', name: 'Xích Thố', points: 1100, winRate: '75%' },
    { rank: 3, medal: '🥉', name: 'Hắc Nhãn', points: 950, winRate: '68%' },
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
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-500">Cuộc đua hôm nay</span>
            <div className="mt-2 text-3xl font-extrabold text-gray-900">
              {loading ? '...' : upcomingRaces.length}
            </div>
          </div>
          <div className="text-3xl bg-amber-50 p-3 rounded-2xl text-amber-600">🏇</div>
        </div>

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
          <div className="text-3xl bg-amber-50 group-hover:bg-amber-100 p-3 rounded-2xl text-amber-600 transition-colors">💳</div>
        </button>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-500">Tỉ lệ dự đoán đúng</span>
            <div className="mt-2 text-3xl font-extrabold text-emerald-600">12/20 trận</div>
          </div>
          <div className="text-3xl bg-emerald-50 p-3 rounded-2xl text-emerald-600">🎯</div>
        </div>
      </div>

      {/* Khu vực "Danh sách cuộc đua sắp diễn ra" */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          🏁 Danh sách cuộc đua sắp diễn ra
        </h2>

        {/* Trạng thái đang tải dữ liệu */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-6 border border-gray-100 space-y-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="space-y-2 pt-3 border-t border-gray-50">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trạng thái lỗi hoặc không có dữ liệu */}
        {!loading && error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">
            ⚠️ {error} — *Hệ thống đang tạm thời hiển thị dữ liệu dự phòng.*
          </div>
        )}

        {/* Danh sách thẻ giải đấu lấy từ API thật */}
        {!loading && upcomingRaces.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl border border-gray-200 text-gray-400">
            Hiện tại chưa có giải đấu nào được khởi tranh từ hệ thống.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingRaces.map((race) => (
              <div
                key={race.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden"
              >
                <div className="p-6 space-y-4">
                  <span className="inline-block px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 rounded-full">
                    {race.tournament}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 leading-snug">
                    {race.name}
                  </h3>
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
                <div className="px-6 pb-6 pt-2">
                  <button
                    onClick={() => navigate('/spectator/prediction')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all duration-150 active:scale-[0.98] shadow-sm"
                  >
                    Xem & Đặt dự đoán
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Khu vực "Bảng xếp hạng chiến mã nhanh nhất giải" */}
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
                  <tr key={horse.rank} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-center text-xl font-bold">{horse.medal}</td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-gray-950 flex items-center gap-2">
                        <span>🐴</span>
                        {horse.name}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-gray-700">
                      {horse.points.toLocaleString('vi-VN')} điểm
                    </td>
                    <td className="py-4 px-6 text-right pr-8 font-bold text-emerald-600">{horse.winRate}</td>
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