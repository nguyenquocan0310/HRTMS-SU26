import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyCareerStats, getMyInvitations, getMyJockeyRaceEntries } from '../../services/jockeyService'
import { getNotifications, type Notification } from '../../services/notificationService'

interface DashboardSummary {
  pendingInvitations: number
  acceptedPairings: number
  raceEntries: number
  officialRaces: number
  notifications: Notification[]
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Không tải được dữ liệu tổng quan.'

export default function JockeyDashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [pendingInvitations, acceptedPairings, raceEntries, stats, notifications] = await Promise.all([
        getMyInvitations('Pending', 1, 1),
        getMyInvitations('Accepted', 1, 1),
        getMyJockeyRaceEntries(1, 1),
        getMyCareerStats(),
        getNotifications(1, 5),
      ])
      setSummary({
        pendingInvitations: pendingInvitations.totalCount,
        acceptedPairings: acceptedPairings.totalCount,
        raceEntries: raceEntries.totalCount,
        officialRaces: stats.totalRaces,
        notifications,
      })
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => { void loadDashboard() }, 0)
    return () => window.clearTimeout(id)
  }, [loadDashboard])

  if (loading) {
    return <div className="space-y-6" aria-busy="true"><div className="h-20 animate-pulse rounded-xl bg-white" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div></div>
  }

  if (error || !summary) {
    return <div className="max-w-xl rounded-xl border border-red-200 bg-white p-6 shadow-sm"><h1 className="text-lg font-bold text-slate-900">Không tải được tổng quan</h1><p role="alert" className="mt-2 text-sm text-red-700">{error || 'Dữ liệu tổng quan không tồn tại.'}</p><button type="button" onClick={() => void loadDashboard()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold">Thử lại</button></div>
  }

  const cards = [
    { label: 'Lời mời chờ phản hồi', value: summary.pendingInvitations, to: '/jockey/invitations' },
    { label: 'Pairing đã chấp nhận', value: summary.acceptedPairings, to: '/jockey/invitations' },
    { label: 'Race entry được phân', value: summary.raceEntries, to: '/jockey/races' },
    { label: 'Cuộc đua Official', value: summary.officialRaces, to: '/jockey/history' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Cổng Jockey</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Tổng quan công việc</h1></div>
        <button type="button" onClick={() => navigate('/jockey/tournaments')} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold">Xem giải đang mở</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <button key={card.label} type="button" onClick={() => navigate(card.to)} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#cfa73d]"><p className="text-sm font-semibold text-slate-500">{card.label}</p><p className="mt-3 text-3xl font-black text-slate-950">{card.value.toLocaleString('vi-VN')}</p><p className="mt-2 text-xs font-bold text-blue-700">Xem chi tiết</p></button>)}
      </div>

      {summary.pendingInvitations > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-black uppercase tracking-wide text-amber-700">Cần xử lý</p><h2 className="mt-1 font-bold text-amber-950">Bạn có {summary.pendingInvitations} lời mời đang chờ phản hồi.</h2><button type="button" onClick={() => navigate('/jockey/invitations')} className="mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-900">Xem lời mời</button></section>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-slate-900">Thông báo gần nhất</h2><p className="mt-1 text-xs text-slate-500">Tối đa 5 thông báo mới nhất từ hệ thống.</p></div><button type="button" onClick={() => navigate('/jockey/notifications')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Xem tất cả</button></div>
        {summary.notifications.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có thông báo.</p> : <ul className="divide-y divide-slate-100">{summary.notifications.map((notification) => <li key={notification.notificationId} className={`px-5 py-4 ${notification.isRead ? 'bg-white' : 'bg-blue-50/60'}`}><div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><p className="text-sm font-bold text-slate-900">{notification.title}</p><time className="text-xs text-slate-400" dateTime={notification.sentAt}>{new Date(notification.sentAt).toLocaleString('vi-VN')}</time></div><p className="mt-1 line-clamp-2 text-sm text-slate-600">{notification.message}</p></li>)}</ul>}
      </section>
    </div>
  )
}
