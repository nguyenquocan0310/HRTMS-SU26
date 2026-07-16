import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getMyTournamentParticipations,
  getTournaments,
  registerForTournament,
  type ParticipationResponse,
  type TournamentResponse,
} from '../../services/tournamentService'

const tournamentStatus: Record<string, { label: string; cls: string }> = {
  'Open Registration': { label: 'Mở đăng ký', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  'Closed Registration': { label: 'Đóng đăng ký', cls: 'border-slate-200 bg-slate-100 text-slate-600' },
  Upcoming: { label: 'Sắp diễn ra', cls: 'border-blue-200 bg-blue-50 text-blue-700' },
  Active: { label: 'Đang diễn ra', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  Completed: { label: 'Đã kết thúc', cls: 'border-slate-200 bg-slate-100 text-slate-600' },
  Cancelled: { label: 'Đã hủy', cls: 'border-red-200 bg-red-50 text-red-700' },
  Draft: { label: 'Nháp', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
}
const participationStatus: Record<string, { label: string; cls: string }> = {
  Pending: { label: 'Chờ duyệt', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  Approved: { label: 'Đã duyệt', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  Rejected: { label: 'Bị từ chối', cls: 'border-red-200 bg-red-50 text-red-700' },
}
const formatDate = (value: string) => new Date(value).toLocaleDateString('vi-VN')
const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

function StatusBadge({ status }: { status: string }) {
  const config = tournamentStatus[status] ?? { label: status, cls: 'border-slate-200 bg-slate-100 text-slate-600' }
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${config.cls}`}>{config.label}</span>
}

function ParticipationBadge({ participation }: { participation: ParticipationResponse }) {
  const config = participationStatus[participation.status] ?? { label: participation.status, cls: 'border-slate-200 bg-slate-100 text-slate-600' }
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${config.cls}`}>{config.label}</span>
}

export default function JockeyTournamentList() {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([])
  const [participations, setParticipations] = useState<ParticipationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<TournamentResponse | null>(null)
  const [registeringId, setRegisteringId] = useState<number | null>(null)

  const loadPage = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [tournamentData, participationData] = await Promise.all([
        getTournaments(), getMyTournamentParticipations(),
      ])
      setTournaments(tournamentData)
      setParticipations(participationData.filter((item) => item.role === 'Jockey'))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Không tải được danh sách giải đấu và đăng ký của bạn.'))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { const id = window.setTimeout(() => void loadPage(), 0); return () => window.clearTimeout(id) }, [loadPage])

  const participationByTournament = useMemo(
    () => new Map(participations.map((item) => [item.tournamentId, item])),
    [participations],
  )
  const displayed = useMemo(() => tournaments.filter((tournament) => {
    if (!showAll && tournament.status !== 'Open Registration') return false
    return tournament.name.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))
  }), [search, showAll, tournaments])

  const handleRegister = async (tournamentId: number) => {
    if (participationByTournament.has(tournamentId) || registeringId !== null) return
    setRegisteringId(tournamentId); setError(''); setSuccess('')
    try {
      const participation = await registerForTournament(tournamentId)
      setParticipations((current) => [participation, ...current.filter((item) => item.tournamentId !== tournamentId)])
      setSuccess('Đã gửi đăng ký. Trạng thái hiện tại do backend quyết định và được hiển thị bên dưới.')
    } catch (registerError) {
      setError(getErrorMessage(registerError, 'Đăng ký giải đấu thất bại.'))
    } finally { setRegisteringId(null) }
  }

  const selectedParticipation = selected ? participationByTournament.get(selected.tournamentId) ?? null : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Tham gia giải</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Giải đấu của Jockey</h1></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">{tournaments.filter((item) => item.status === 'Open Registration').length} giải đang mở</div></div>
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div>}
      {error && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span>{tournaments.length === 0 && <button type="button" onClick={() => void loadPage()} className="font-bold underline">Thử lại</button>}</div>}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row"><label className="flex-1 text-xs font-bold uppercase tracking-wide text-slate-500">Tìm giải<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên giải đấu" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label><button type="button" onClick={() => setShowAll((value) => !value)} className="self-end rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">{showAll ? 'Chỉ xem giải mở đăng ký' : 'Xem tất cả giải'}</button></div>
      {participations.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Đăng ký của bạn</h2><div className="mt-3 flex flex-wrap gap-2">{participations.map((item) => <div key={item.participantId} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><span className="text-sm font-semibold text-slate-700">{item.tournamentName || `Giải ${item.tournamentId}`}</span><ParticipationBadge participation={item} /></div>)}</div></section>}
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">{[0,1,2,3,4,5].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div> : displayed.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"><h2 className="font-bold text-slate-900">Không có giải đấu phù hợp</h2><p className="mt-2 text-sm text-slate-500">Thử thay đổi từ khóa hoặc phạm vi hiển thị.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{displayed.map((tournament) => { const participation = participationByTournament.get(tournament.tournamentId); return <article key={tournament.tournamentId} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#cfa73d]"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-black text-slate-950">{tournament.name}</h2><StatusBadge status={tournament.status} /></div><p className="mt-2 text-xs text-slate-500">{formatDate(tournament.startDate)} đến {formatDate(tournament.endDate)}</p><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Kinh nghiệm tối thiểu</dt><dd className="mt-1 font-bold text-slate-900">{tournament.minJockeyExperienceYears} năm</dd></div><div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Giải thưởng</dt><dd className="mt-1 truncate font-bold text-slate-900">{formatCurrency(tournament.purseAmount)}</dd></div></dl>{participation && <div className="mt-4"><ParticipationBadge participation={participation} />{participation.status === 'Rejected' && (participation.rejectionReason || participation.screeningReason) && <p className="mt-2 text-xs leading-5 text-red-700">Lý do: {participation.rejectionReason || participation.screeningReason}</p>}</div>}<button type="button" onClick={() => setSelected(tournament)} className="mt-auto pt-5"><span className="block rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-bold">Xem chi tiết</span></button></article> })}</div>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><div role="dialog" aria-modal="true" aria-labelledby="tournament-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4"><div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Chi tiết giải đấu</p><h2 id="tournament-title" className="mt-1 text-xl font-black text-slate-950">{selected.name}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Đóng</button></div><div className="space-y-5 p-5"><div className="flex flex-wrap items-center gap-3"><StatusBadge status={selected.status} /><span className="text-sm text-slate-500">{formatDate(selected.startDate)} đến {formatDate(selected.endDate)}</span></div>{selected.description && <p className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selected.description}</p>}<dl className="grid gap-3 sm:grid-cols-2">{[['Giống ngựa cho phép', selected.allowedBreed], ['Loại đường đua', selected.trackType], ['Khoảng cách', `${selected.raceDistance} m`], ['Hạng mục', selected.raceCategory], ['Kinh nghiệm tối thiểu', `${selected.minJockeyExperienceYears} năm`], ['Số ngựa tối đa', selected.maxHorses.toLocaleString('vi-VN')], ['Tổng giải thưởng', formatCurrency(selected.purseAmount)], ['Phí tham dự', formatCurrency(selected.entryFeeAmount)]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-900">{value}</dd></div>)}</dl>{selectedParticipation ? <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-900">Trạng thái đăng ký</p><ParticipationBadge participation={selectedParticipation} /></div>{selectedParticipation.status === 'Pending' && <p className="mt-2 text-sm text-slate-600">Đăng ký đang chờ Admin duyệt; chưa được xem là đã tham gia.</p>}{selectedParticipation.status === 'Rejected' && <p className="mt-2 text-sm text-red-700">{selectedParticipation.rejectionReason || selectedParticipation.screeningReason || 'Backend không cung cấp lý do từ chối.'}</p>}</div> : selected.status === 'Open Registration' ? <button type="button" onClick={() => void handleRegister(selected.tournamentId)} disabled={registeringId !== null} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black disabled:cursor-wait disabled:opacity-60">{registeringId === selected.tournamentId ? 'Đang đăng ký...' : 'Đăng ký tham gia roster'}</button> : <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Giải hiện không mở đăng ký nên không có hành động đăng ký.</p>}</div></div></div>}
    </div>
  )
}
