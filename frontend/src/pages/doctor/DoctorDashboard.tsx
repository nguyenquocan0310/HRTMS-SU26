import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyTournamentParticipations } from '../../services/tournamentService'
import { getMyDoctorRaceAssignments, type DoctorRaceAssignment } from '../../services/doctorService'

// ─── Status badge helper ──────────────────────────────────────────────────────

const RACE_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  // ── Sắp diễn ra ──
  Upcoming:        { label: 'Sắp diễn ra',  cls: 'bg-blue-50 text-blue-700 border border-blue-100'         },
  'Sắp diễn ra':  { label: 'Sắp diễn ra',  cls: 'bg-blue-50 text-blue-700 border border-blue-100'         },
  // ── Đang diễn ra ──
  Active:          { label: 'Đang diễn ra', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  Running:         { label: 'Đang diễn ra', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  InProgress:      { label: 'Đang diễn ra', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  'Đang diễn ra': { label: 'Đang diễn ra', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  // ── Đã hoàn thành ──
  Completed:       { label: 'Đã hoàn thành', cls: 'bg-gray-50 text-gray-600 border border-gray-100'         },
  Official:        { label: 'Chính thức',    cls: 'bg-gray-50 text-gray-600 border border-gray-100'         },
  'Đã hoàn thành': { label: 'Đã hoàn thành', cls: 'bg-gray-50 text-gray-600 border border-gray-100'        },
  // ── Đã hủy ──
  Cancelled:       { label: 'Đã hủy',        cls: 'bg-red-50 text-red-600 border border-red-100'            },
}

function RaceStatusBadge({ status }: { status: string }) {
  const cfg = RACE_STATUS_MAP[status] ?? {
    label: status,
    cls: 'bg-gray-50 text-gray-500 border border-gray-100',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

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
        setParticipationStatus('none')
      })
  }, [])

  // ── Danh sách race assignments từ API thật ────────────────────────────────────
  const [assignments, setAssignments] = useState<DoctorRaceAssignment[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null)

  useEffect(() => {
    setAssignmentsLoading(true)
    setAssignmentsError(null)
    getMyDoctorRaceAssignments()
      .then((data) => {
        setAssignments(data)
      })
      .catch((err: any) => {
        console.error('Failed to load race assignments:', err)
        setAssignmentsError(err?.message || 'Không tải được danh sách phân công.')
      })
      .finally(() => setAssignmentsLoading(false))
  }, [])

  const openPaddock = (raceId: number) => {
    navigate(`/doctor/paddock?raceId=${raceId}`)
  }

  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
          <p className="text-sm text-gray-500 mt-1">Thông tin tổng quan và phân công công việc hôm nay</p>
        </div>
        <div className="text-sm text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-md shadow-sm">
          Hôm nay: {new Date().toLocaleDateString('vi-VN')}
        </div>
      </div>

      {/* ── Banners trạng thái đăng ký giải ── */}
      {participationStatus === 'none' && (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <div className="flex-1">
            <p className="font-semibold text-sm">Chưa đăng ký giải đấu nào</p>
            <p className="text-xs text-amber-700 mt-1">
              Bạn chưa được duyệt tham gia giải nào. Hãy đăng ký một giải đang mở đăng ký để được phân công nhiệm vụ.
            </p>
          </div>
          <button
            onClick={() => navigate('/doctor/tournaments')}
            className="flex-shrink-0 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
          >
            Đăng ký ngay
          </button>
        </div>
      )}

      {participationStatus === 'pending' && (
        <div className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
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
          <div className="flex-1">
            <p className="font-semibold text-sm">Đăng ký bị từ chối</p>
            <p className="text-xs text-red-700 mt-1">
              Đăng ký tham gia giải của bạn đã bị từ chối. Vui lòng liên hệ Admin hoặc thử đăng ký giải khác.
            </p>
          </div>
          <button
            onClick={() => navigate('/doctor/tournaments')}
            className="flex-shrink-0 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 border border-red-300 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
          >
            Xem giải đấu
          </button>
        </div>
      )}

      {/* Hệ thống 4 thẻ chỉ số (Stats Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Thẻ 1: Race được phân công */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Race được phân công</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {assignmentsLoading ? '…' : assignments.length}
            </p>
          </div>
        </div>

        {/* Thẻ 2: Chờ kiểm tra - Clickable */}
        <button
          onClick={() => navigate('/doctor/paddock')}
          className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30 text-left focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sắp diễn ra</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {assignmentsLoading ? '…' : assignments.filter(a =>
                a.raceStatus === 'Upcoming' || a.raceStatus === 'Sắp diễn ra'
              ).length}
            </p>
          </div>
        </button>

        {/* Thẻ 3: Đang diễn ra */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Đang diễn ra</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {assignmentsLoading ? '…' : assignments.filter(a =>
                a.raceStatus === 'Active' || a.raceStatus === 'Running' ||
                a.raceStatus === 'InProgress' || a.raceStatus === 'Đang diễn ra'
              ).length}
            </p>
          </div>
        </div>

        {/* Thẻ 4: Đã hoàn thành */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Đã hoàn thành</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {assignmentsLoading ? '…' : assignments.filter(a =>
                a.raceStatus === 'Completed' || a.raceStatus === 'Official' ||
                a.raceStatus === 'Đã hoàn thành'
              ).length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Khu vực khai báo COI thật */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col justify-between">
          <div className="p-6">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
              Khai báo quan hệ COI
            </h2>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              Khai báo người thân hoặc quan hệ có thể ảnh hưởng đến phân công y tế trong giải đấu. Doctor chỉ khai báo dữ liệu, hệ thống sẽ tự kiểm tra COI khi Admin phân công vào Race.
            </p>
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-blue-800">
              Dữ liệu khai báo được dùng cho Phase 4: Official Assignment & COI Clearance.
            </div>
          </div>
          <div className="border-t border-gray-100 p-6 pt-4">
            <button
              onClick={() => navigate('/doctor/coi')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-md text-sm font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              Mở khai báo COI
            </button>
          </div>
        </div>

        {/* ── Khu vực "Race được phân công" ── thay mock bằng API thật */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
            Race được phân công
          </h2>

          {/* Loading */}
          {assignmentsLoading && (
            <div className="flex-1 flex items-center justify-center py-10">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mr-3" />
              <p className="text-sm text-gray-500">Đang tải danh sách phân công...</p>
            </div>
          )}

          {/* Error */}
          {!assignmentsLoading && assignmentsError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700">{assignmentsError}</p>
            </div>
          )}

          {/* Empty state */}
          {!assignmentsLoading && !assignmentsError && assignments.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-semibold text-gray-600">Chưa có race nào được phân công</p>
              <p className="text-xs text-gray-400 mt-1">Admin sẽ phân công khi giải bắt đầu</p>
            </div>
          )}

          {/* Assignment table */}
          {!assignmentsLoading && !assignmentsError && assignments.length > 0 && (
            <div className="overflow-x-auto mt-4 flex-1">
              <table className="w-full text-left text-sm text-gray-700">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-3">Giải đấu / Vòng</th>
                    <th className="py-3 px-3">Race #</th>
                    <th className="py-3 px-3">Thời gian đua</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {assignments.map((item) => (
                    <tr key={item.raceId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3.5 px-3">
                        <p className="font-medium text-gray-900 text-xs leading-tight">{item.tournamentName}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{item.roundName}</p>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-xs font-bold text-gray-700">
                        #{item.raceNumber}
                      </td>
                      <td className="py-3.5 px-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(item.scheduledTime).toLocaleString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-3">
                        <RaceStatusBadge status={item.raceStatus} />
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => openPaddock(item.raceId)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap"
                        >
                          Mở Paddock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => navigate('/doctor/paddock')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 focus:outline-none"
            >
              Xem bàn điều khiển Paddock
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
