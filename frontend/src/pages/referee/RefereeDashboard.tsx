import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNotifications, type Notification } from '../../services/notificationService'
import { getMyRefereeRaceAssignments, type RefereeRaceAssignment } from '../../services/refereeService'
import { getMyTournamentParticipations } from '../../services/tournamentService'

interface DashboardData {
  assignments: RefereeRaceAssignment[]
  approvedTournaments: number
  notifications: Notification[]
}

const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa có lịch'
const statusStyle = (status?: string | null) => status === 'Live' ? 'border-red-200 bg-red-50 text-red-700' : status === 'Unofficial' ? 'border-amber-200 bg-amber-50 text-amber-700' : status === 'Official' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'Cancelled' ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-blue-100 bg-blue-50 text-blue-700'

export default function RefereeDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [assignments, participations, notifications] = await Promise.all([
        getMyRefereeRaceAssignments(),
        getMyTournamentParticipations(),
        getNotifications(1, 5),
      ])
      setData({ assignments, approvedTournaments: participations.filter((item) => item.status === 'Approved').length, notifications })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu tổng quan.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { const id = window.setTimeout(() => void loadDashboard(), 0); return () => window.clearTimeout(id) }, [loadDashboard])

  const nextAssignment = useMemo(() => data?.assignments.filter((item) => item.raceStatus === 'Upcoming' || item.raceStatus === 'Pre-Race').sort((a, b) => new Date(a.scheduledTime ?? 0).getTime() - new Date(b.scheduledTime ?? 0).getTime())[0], [data])

  if (loading) return <div className="space-y-6" aria-busy="true"><div className="h-20 animate-pulse rounded-xl bg-white" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div><div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" /></div>
  if (error || !data) return <div className="max-w-xl rounded-xl border border-red-200 bg-white p-6 shadow-sm"><h1 className="text-lg font-bold text-slate-900">Không tải được tổng quan</h1><p role="alert" className="mt-2 text-sm text-red-700">{error || 'Dữ liệu tổng quan không tồn tại.'}</p><button type="button" onClick={() => void loadDashboard()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold">Thử lại</button></div>

  const cards = [
    { label: 'Giải đã được duyệt', value: data.approvedTournaments, to: '/referee/tournaments' },
    { label: 'Race được phân công', value: data.assignments.length, to: '/referee/race-console' },
    { label: 'Sắp diễn ra', value: data.assignments.filter((item) => item.raceStatus === 'Upcoming' || item.raceStatus === 'Pre-Race').length, to: '/referee/race-console' },
    { label: 'Đang Live', value: data.assignments.filter((item) => item.raceStatus === 'Live').length, to: '/referee/race-console' },
  ]

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Cổng Referee</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Tổng quan công việc</h1><p className="mt-2 text-sm text-slate-500">Theo dõi roster, phân công và các cuộc đua trong phạm vi của bạn.</p></div><button type="button" onClick={() => navigate('/referee/tournaments')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold">Xem giải đang mở</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <button key={card.label} type="button" onClick={() => navigate(card.to)} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#cfa73d]"><p className="text-sm font-semibold text-slate-500">{card.label}</p><p className="mt-3 text-3xl font-black text-slate-950">{card.value.toLocaleString('vi-VN')}</p><p className="mt-2 text-xs font-bold text-blue-700">Xem chi tiết</p></button>)}</div>
    {nextAssignment && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-amber-700">Nhiệm vụ tiếp theo</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-amber-950">{nextAssignment.tournamentName ?? 'Giải đấu'} · Race #{nextAssignment.raceNumber ?? nextAssignment.raceId}</h2><p className="mt-1 text-sm text-amber-800">{formatDateTime(nextAssignment.scheduledTime)} · {nextAssignment.assignmentRole ?? nextAssignment.role ?? 'Referee'}</p></div><button type="button" onClick={() => navigate(`/referee/race-console?raceId=${nextAssignment.raceId}`)} className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900">Mở bàn điều hành</button></div></section>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Phân công gần nhất</h2><p className="mt-1 text-xs text-slate-500">Chỉ hiển thị các race do Admin phân công cho bạn.</p></div><button type="button" onClick={() => navigate('/referee/race-console')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Xem tất cả</button></div>{data.assignments.length === 0 ? <div className="px-5 py-12 text-center"><p className="text-sm font-bold text-slate-700">Chưa có race nào được phân công.</p><p className="mt-1 text-xs text-slate-500">Bạn cần được duyệt vào roster trước khi Admin phân công race.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Giải đấu / vòng</th><th className="px-5 py-3">Race</th><th className="px-5 py-3">Thời gian</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{data.assignments.slice(0, 5).map((item) => <tr key={`${item.raceId}-${item.assignedAt}`}><td className="px-5 py-4"><p className="font-bold text-slate-900">{item.tournamentName ?? '—'}</p><p className="mt-1 text-xs text-slate-500">{item.roundName ?? '—'}</p></td><td className="px-5 py-4 font-bold">#{item.raceNumber ?? item.raceId}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDateTime(item.scheduledTime)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle(item.raceStatus)}`}>{item.raceStatus ?? '—'}</span></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => navigate(`/referee/race-console?raceId=${item.raceId}`)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold">Mở bàn điều hành</button></td></tr>)}</tbody></table></div>}</section>
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Thông báo gần nhất</h2><p className="mt-1 text-xs text-slate-500">Tối đa 5 thông báo mới nhất từ hệ thống.</p></div><button type="button" onClick={() => navigate('/referee/notifications')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Xem tất cả</button></div>{data.notifications.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có thông báo.</p> : <ul className="divide-y divide-slate-100">{data.notifications.map((notification) => <li key={notification.notificationId} className={`px-5 py-4 ${notification.isRead ? 'bg-white' : 'bg-blue-50/60'}`}><div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><p className="text-sm font-bold text-slate-900">{notification.title}</p><time className="text-xs text-slate-400" dateTime={notification.sentAt}>{formatDateTime(notification.sentAt)}</time></div><p className="mt-1 line-clamp-2 text-sm text-slate-600">{notification.message}</p></li>)}</ul>}</section>
  </div>
}
