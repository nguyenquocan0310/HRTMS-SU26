import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyTournamentParticipations } from '../../services/tournamentService'

interface ScheduleItem {
  id: string
  raceRun: string
  checkTime: string
  checkType: 'Weigh-In' | 'Vet Check' | 'Weigh-Out'
  subject: string
  status: 'Đã hoàn thành' | 'Đang chờ' | 'Chưa bắt đầu'
}

export default function DoctorDashboard() {
  const navigate = useNavigate()

  // ── Trạng thái participation từ API ──────────────────────────────────────────
  const [participationStatus, setParticipationStatus] = useState<
    'loading' | 'none' | 'pending' | 'approved' | 'rejected'
  >('loading')

  useEffect(() => {
    getMyTournamentParticipations()
      .then((list) => {
        if (list.length === 0) {
          setParticipationStatus('none')
          return
        }
        const hasApproved = list.some(
          (p) => p.status === 'Approved' || p.status === 'AutoEligible'
        )
        const hasPending = list.some(
          (p) => p.status === 'Pending' || p.status === 'ManualReview'
        )
        if (hasApproved) setParticipationStatus('approved')
        else if (hasPending) setParticipationStatus('pending')
        else setParticipationStatus('rejected')
      })
      .catch(() => {
        // Không chặn dashboard nếu API lỗi — giữ trạng thái loading im lặng
        setParticipationStatus('none')
      })
  }, [])

  const scheduleData: ScheduleItem[] = [
    {
      id: 'S1',
      raceRun: 'Lượt 1 - Chung kết Nam',
      checkTime: '08:30',
      checkType: 'Weigh-In',
      subject: 'Nguyễn Văn Hùng (Kỵ sĩ)',
      status: 'Đã hoàn thành'
    },
    {
      id: 'S2',
      raceRun: 'Lượt 2 - Vòng loại A',
      checkTime: '10:15',
      checkType: 'Vet Check',
      subject: 'Kim Long - Mã số #V102 (Ngựa)',
      status: 'Đang chờ'
    },
    {
      id: 'S3',
      raceRun: 'Lượt 3 - Vòng loại B',
      checkTime: '14:00',
      checkType: 'Weigh-Out',
      subject: 'Lê Hoàng Nam (Kỵ sĩ)',
      status: 'Chưa bắt đầu'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng điều khiển</h1>
          <p className="text-sm text-gray-500 mt-1">Thông tin tổng quan và phân công công việc hôm nay</p>
        </div>
        <div className="text-sm text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
          📅 Hôm nay: {new Date().toLocaleDateString('vi-VN')}
        </div>
      </div>

      {/* ── Banners trạng thái đăng ký giải ── */}
      {participationStatus === 'none' && (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl mt-0.5 flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">Chưa đăng ký giải đấu nào</p>
            <p className="text-xs text-amber-700 mt-1">
              Bạn chưa được duyệt tham gia giải nào. Hãy đăng ký một giải đang mở đăng ký để được phân công nhiệm vụ.
            </p>
          </div>
          <button
            onClick={() => navigate('/doctor/tournaments')}
            className="flex-shrink-0 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Đăng ký ngay ➔
          </button>
        </div>
      )}

      {participationStatus === 'pending' && (
        <div className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl mt-0.5 flex-shrink-0">⏳</span>
          <div>
            <p className="font-semibold text-sm">Đăng ký giải đang chờ Admin duyệt</p>
            <p className="text-xs text-blue-700 mt-1">
              Hồ sơ đăng ký của bạn đang trong quá trình xét duyệt. Bạn sẽ được thông báo khi có kết quả.
            </p>
          </div>
        </div>
      )}

      {participationStatus === 'rejected' && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl mt-0.5 flex-shrink-0">❌</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">Đăng ký bị từ chối</p>
            <p className="text-xs text-red-700 mt-1">
              Đăng ký tham gia giải của bạn đã bị từ chối. Vui lòng liên hệ Admin hoặc thử đăng ký giải khác.
            </p>
          </div>
          <button
            onClick={() => navigate('/doctor/tournaments')}
            className="flex-shrink-0 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 border border-red-300 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Xem giải đấu ➔
          </button>
        </div>
      )}

      {/* Hệ thống 4 thẻ chỉ số (Stats Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Thẻ 1: Phiên khám hôm nay */}
        <div className="bg-white border border-emerald-100 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-200 hover:shadow-md">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Phiên khám hôm nay</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">8</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-xl text-2xl font-semibold shadow-inner">
            🏥
          </div>
        </div>

        {/* Thẻ 2: Chờ kiểm tra - Clickable */}
        <button
          onClick={() => navigate('/doctor/paddock')}
          className="bg-white border border-yellow-100 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-200 hover:shadow-md hover:border-yellow-200 text-left focus:outline-none focus:ring-2 focus:ring-yellow-200"
        >
          <div>
            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Chờ kiểm tra</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">3</p>
          </div>
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 flex items-center justify-center rounded-xl text-2xl font-semibold shadow-inner">
            ⏳
          </div>
        </button>

        {/* Thẻ 3: Đã thông qua */}
        <div className="bg-white border border-green-100 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-200 hover:shadow-md">
          <div>
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Đã thông qua</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">5</p>
          </div>
          <div className="w-12 h-12 bg-green-50 text-green-600 flex items-center justify-center rounded-xl text-2xl font-semibold shadow-inner">
            ✅
          </div>
        </div>

        {/* Thẻ 4: Không đạt điều kiện */}
        <div className="bg-white border border-red-100 rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-200 hover:shadow-md">
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Không đạt điều kiện</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">0</p>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 flex items-center justify-center rounded-xl text-2xl font-semibold shadow-inner">
            ❌
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Khu vực khai báo COI thật */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="p-6">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              Khai báo quan hệ COI
            </h2>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              Khai báo người thân hoặc quan hệ có thể ảnh hưởng đến phân công y tế trong giải đấu. Doctor chỉ khai báo dữ liệu, hệ thống sẽ tự kiểm tra COI khi Admin phân công vào Race.
            </p>
            <div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
              Dữ liệu khai báo được dùng cho Phase 4: Official Assignment & COI Clearance.
            </div>
          </div>
          <div className="border-t border-gray-100 p-6 pt-4">
            <button
              onClick={() => navigate('/doctor/coi')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg text-sm font-semibold transition-all shadow-sm shadow-emerald-600/10 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              Mở khai báo COI
            </button>
          </div>
        </div>
        {/* Khu vực "Lịch phân công hôm nay" */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              📅 Lịch phân công hôm nay
            </h2>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-sm text-gray-700">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Lượt đua</th>
                    <th className="py-3 px-4">Giờ khám</th>
                    <th className="py-3 px-4">Loại kiểm tra</th>
                    <th className="py-3 px-4">Đối tượng kiểm tra</th>
                    <th className="py-3 px-4 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {scheduleData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-gray-900 text-xs">{item.raceRun}</td>
                      <td className="py-3.5 px-4 font-mono text-xs">{item.checkTime}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                          {item.checkType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-gray-600">{item.subject}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.status === 'Đã hoàn thành'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : item.status === 'Đang chờ'
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                              : 'bg-gray-50 text-gray-500 border border-gray-100'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => navigate('/doctor/paddock')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 focus:outline-none"
            >
              Xem chi tiết bàn điều khiển Paddock ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


