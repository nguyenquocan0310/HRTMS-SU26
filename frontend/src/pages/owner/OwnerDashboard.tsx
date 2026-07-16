import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiArrowRight, FiAward, FiCalendar, FiCheckCircle, FiDollarSign, FiLink2, FiRefreshCw } from 'react-icons/fi'
import { getMyAccountProfile } from '../../services/accountService'
import {
  getHorseEnrollments,
  getMyHorses,
  getMyRaceEntries,
  getOwnerEarnings,
  getOwnerPairings,
  type HorseEnrollmentResponse,
} from '../../services/ownerService'
import { getMyTournamentParticipations } from '../../services/tournamentService'

interface DashboardData {
  ownerName: string | null
  horseCount: number | null
  approvedEnrollmentCount: number | null
  approvedTournamentCount: number | null
  pendingPairings: number | null
  acceptedPairings: number | null
  entriesToConfirm: number | null
  feeAttention: number | null
  totalEarnings: number | null
  failedSources: number
}

const initialData: DashboardData = {
  ownerName: null,
  horseCount: null,
  approvedEnrollmentCount: null,
  approvedTournamentCount: null,
  pendingPairings: null,
  acceptedPairings: null,
  entriesToConfirm: null,
  feeAttention: null,
  totalEarnings: null,
  failedSources: 0,
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase()
const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export default function OwnerDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    const horsesWithEnrollments = async () => {
      const horses = await getMyHorses()
      const enrollmentResults = await Promise.all(horses.map(async (horse) => {
        const horseId = horse.horseID ?? (horse as { horseId?: number }).horseId
        if (!horseId) return []
        return (await getHorseEnrollments(horseId)) ?? []
      }))
      return { horses, enrollments: enrollmentResults.flat() }
    }

    const results = await Promise.allSettled([
      getMyAccountProfile(),
      horsesWithEnrollments(),
      getMyTournamentParticipations(),
      getOwnerPairings(undefined, undefined, 1, 100),
      getMyRaceEntries(undefined, undefined, 1, 100),
      getOwnerEarnings(),
    ] as const)

    const failedSources = results.filter((result) => result.status === 'rejected').length
    const [profileResult, horseResult, participationResult, pairingResult, entryResult, earningsResult] = results

    const enrollments: HorseEnrollmentResponse[] = horseResult.status === 'fulfilled' ? horseResult.value.enrollments : []
    const pairings = pairingResult.status === 'fulfilled' ? pairingResult.value : []
    const entries = entryResult.status === 'fulfilled' ? entryResult.value : []

    setData({
      ownerName: profileResult.status === 'fulfilled' ? profileResult.value.fullName : null,
      horseCount: horseResult.status === 'fulfilled' ? horseResult.value.horses.length : null,
      approvedEnrollmentCount: horseResult.status === 'fulfilled'
        ? enrollments.filter((item) => normalize(item.status) === 'enrolled' && normalize(item.adminApprovalStatus) === 'approved').length
        : null,
      approvedTournamentCount: participationResult.status === 'fulfilled'
        ? participationResult.value.filter((item) => normalize(item.status) === 'approved').length
        : null,
      pendingPairings: pairingResult.status === 'fulfilled'
        ? pairings.filter((item) => ['pending', 'accepted'].includes(normalize(item.status))).length
        : null,
      acceptedPairings: pairingResult.status === 'fulfilled'
        ? pairings.filter((item) => normalize(item.status) === 'accepted').length
        : null,
      entriesToConfirm: entryResult.status === 'fulfilled'
        ? entries.filter((item) => ['pending', 'pendingconf'].includes(normalize(item.status))).length
        : null,
      feeAttention: entryResult.status === 'fulfilled'
        ? entries.filter((item) => ['unpaid', 'refund pending'].includes(normalize(item.entryFeeStatus))).length
        : null,
      totalEarnings: earningsResult.status === 'fulfilled' ? earningsResult.value.totalEarnings : null,
      failedSources,
    })

    if (failedSources === results.length) setError('Không thể tải dữ liệu tổng quan. Vui lòng thử lại.')
    setLoading(false)
  }, [])

  useEffect(() => {
    const loadId = window.setTimeout(() => { void loadDashboard() }, 0)
    return () => window.clearTimeout(loadId)
  }, [loadDashboard])

  const tasks = useMemo(() => {
    const items: Array<{ title: string; description: string; to: string; tone: 'gold' | 'blue' | 'red' }> = []
    if (data.horseCount === 0) items.push({ title: 'Tạo hồ sơ ngựa đầu tiên', description: 'Hồ sơ ngựa được tạo riêng trước khi đăng ký vào một giải.', to: '/owner/horses/register', tone: 'gold' })
    if (data.approvedTournamentCount === 0) items.push({ title: 'Đăng ký tham gia giải', description: 'Gửi yêu cầu vào roster và chờ Ban tổ chức phê duyệt.', to: '/owner/tournaments', tone: 'gold' })
    if ((data.horseCount ?? 0) > 0 && data.approvedEnrollmentCount === 0) items.push({ title: 'Đăng ký ngựa vào giải', description: 'Chọn hồ sơ ngựa và giải bạn đã được duyệt tham gia.', to: '/owner/horses', tone: 'blue' })
    if ((data.acceptedPairings ?? 0) > 0) items.push({ title: `Xác nhận ${data.acceptedPairings} ghép cặp`, description: 'Jockey đã chấp nhận lời mời và đang chờ bạn xác nhận.', to: '/owner/jockey-invite', tone: 'blue' })
    if ((data.entriesToConfirm ?? 0) > 0) items.push({ title: `Xử lý ${data.entriesToConfirm} lượt thi đấu`, description: 'Xác nhận tham gia hoặc rút lui theo điều kiện hiện tại.', to: '/owner/race-entries', tone: 'gold' })
    if ((data.feeAttention ?? 0) > 0) items.push({ title: `${data.feeAttention} khoản phí cần chú ý`, description: 'Kiểm tra trạng thái chưa nộp hoặc đang chờ hoàn phí.', to: '/owner/race-entries', tone: 'red' })
    return items.slice(0, 4)
  }, [data])

  const summaryCards = [
    { label: 'Hồ sơ ngựa', value: data.horseCount, icon: FiAward, color: 'text-[#a97812]', bg: 'bg-[#fff7df]' },
    { label: 'Ngựa đủ điều kiện trong giải', value: data.approvedEnrollmentCount, icon: FiCheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Ghép cặp chờ xử lý', value: data.pendingPairings, icon: FiLink2, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Lượt đua cần xác nhận', value: data.entriesToConfirm, icon: FiCalendar, color: 'text-blue-700', bg: 'bg-blue-50' },
  ]

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Đang tải tổng quan">
        <div className="h-36 animate-pulse rounded-3xl bg-white" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-white p-8 text-center">
        <FiAlertCircle className="mx-auto text-red-500" size={28} />
        <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
        <button type="button" onClick={() => void loadDashboard()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#082b20] px-4 py-2.5 text-sm font-bold text-white"><FiRefreshCw /> Thử lại</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#d9c078] bg-[#0a3024] px-6 py-7 text-white shadow-sm sm:px-8">
        <div className="relative z-10 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#e1bc58]">Tổng quan Chủ ngựa</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{data.ownerName ? `Xin chào, ${data.ownerName}` : 'Chào mừng trở lại đường đua'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/75">Theo dõi hồ sơ ngựa, đăng ký giải, ghép cặp Jockey và các lượt thi đấu từ một nơi.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => navigate(tasks[0]?.to || '/owner/horses')} className="inline-flex items-center gap-2 rounded-xl bg-[#cfa73d] px-4 py-2.5 text-sm font-black text-[#082b20] hover:bg-[#e0b94f]">
              {tasks.length > 0 ? 'Xử lý việc tiếp theo' : 'Xem ngựa của tôi'} <FiArrowRight />
            </button>
            <button type="button" onClick={() => navigate('/owner/tournaments')} className="rounded-xl border border-white/20 bg-white/[.06] px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10">Xem giải đấu</button>
          </div>
        </div>
        <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full border-[42px] border-[#cfa73d]/10" aria-hidden="true" />
      </section>

      {data.failedSources > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <FiAlertCircle className="mt-0.5 shrink-0" /> Một phần số liệu tạm thời chưa tải được. Các mục đó được hiển thị bằng dấu “—”, không dùng dữ liệu ước tính.
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Thống kê nhanh">
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-medium text-slate-500">{card.label}</p><p className={`mt-3 text-3xl font-black ${card.color}`}>{card.value ?? '—'}</p></div>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg} ${card.color}`}><Icon size={19} aria-hidden="true" /></span>
              </div>
            </article>
          )
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="font-black text-slate-950">Việc cần làm tiếp theo</h2><p className="mt-1 text-xs text-slate-500">Dựa trên trạng thái hiện tại do hệ thống trả về.</p></div></div>
          {tasks.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center"><FiCheckCircle className="text-emerald-600" size={30} /><p className="mt-3 font-bold text-slate-900">Bạn đã xử lý hết việc cần chú ý</p><p className="mt-1 text-sm text-slate-500">Các cập nhật mới sẽ xuất hiện tại đây.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <button key={`${task.to}-${task.title}`} type="button" onClick={() => navigate(task.to)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 sm:px-6">
                  <span className={`h-10 w-1 rounded-full ${task.tone === 'red' ? 'bg-red-500' : task.tone === 'blue' ? 'bg-blue-500' : 'bg-[#cfa73d]'}`} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">{task.title}</span><span className="mt-1 block text-sm text-slate-500">{task.description}</span></span>
                  <FiArrowRight className="shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Sau cuộc đua</p>
          <div className="mt-4 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FiDollarSign size={21} /></span><div><p className="text-sm text-slate-500">Tổng tiền thưởng</p><p className="text-xl font-black text-slate-950">{data.totalEarnings === null ? '—' : formatCurrency(data.totalEarnings)}</p></div></div>
          <button type="button" onClick={() => navigate('/owner/earnings')} className="mt-6 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-[#d9c078] hover:bg-[#fffaf0]">Xem chi tiết tiền thưởng <FiArrowRight /></button>
        </div>
      </section>
    </div>
  )
}
