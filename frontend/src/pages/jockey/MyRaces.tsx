import { useCallback, useEffect, useState } from 'react'
import { getMyJockeyRaceEntries } from '../../services/jockeyService'
import type { JockeyRaceEntry } from '../../types/jockey.types'

const PAGE_SIZE = 20
const filters = [
  { value: '', label: 'Tất cả' }, { value: 'Pending', label: 'Chờ xác nhận' },
  { value: 'Confirmed', label: 'Đã xác nhận' }, { value: 'Cancelled', label: 'Đã hủy' },
  { value: 'Disqualified', label: 'Bị loại' },
]
const statusStyle: Record<string, string> = {
  Pending: 'border-amber-200 bg-amber-50 text-amber-800', PendingConf: 'border-amber-200 bg-amber-50 text-amber-800',
  Confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700', Accepted: 'border-blue-200 bg-blue-50 text-blue-700',
  Cancelled: 'border-slate-200 bg-slate-100 text-slate-600', Disqualified: 'border-red-200 bg-red-50 text-red-700',
  Declined: 'border-red-200 bg-red-50 text-red-700', Official: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Unofficial: 'border-amber-200 bg-amber-50 text-amber-800', Running: 'border-blue-200 bg-blue-50 text-blue-700',
}
const statusLabel: Record<string, string> = {
  Pending: 'Chờ xác nhận', PendingConf: 'Chờ xác nhận', Confirmed: 'Đã xác nhận',
  Accepted: 'Đã chấp nhận', Cancelled: 'Đã hủy', Disqualified: 'Bị loại',
  Declined: 'Đã từ chối', Official: 'Chính thức', Unofficial: 'Chưa chính thức',
  Running: 'Đang diễn ra',
}
function Badge({ status }: { status: string }) { return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle[status] ?? 'border-slate-200 bg-slate-100 text-slate-600'}`}>{statusLabel[status] ?? status}</span> }
const formatDate = (value: string) => new Date(value).toLocaleString('vi-VN')
const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export default function MyRaces() {
  const [races, setRaces] = useState<JockeyRaceEntry[]>([])
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRaces = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await getMyJockeyRaceEntries(page, PAGE_SIZE, status || undefined)
      setRaces(result.items); setTotalPages(result.totalPages); setTotalCount(result.totalCount)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách cuộc đua.')
    } finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { const id = window.setTimeout(() => void loadRaces(), 0); return () => window.clearTimeout(id) }, [loadRaces])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Thi đấu</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Cuộc đua của tôi</h1></div><span className="self-start rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{totalCount.toLocaleString('vi-VN')} lượt phân công</span></div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200">{filters.map((filter) => <button key={filter.value} type="button" onClick={() => { setStatus(filter.value); setPage(1) }} className={`border-b-2 px-3 py-2 text-sm font-bold ${status === filter.value ? 'border-[#cfa73d] text-slate-950' : 'border-transparent text-slate-500'}`}>{filter.label}</button>)}</div>
      {error && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button type="button" onClick={() => void loadRaces()} className="font-bold underline">Thử lại</button></div>}
      {loading ? <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" aria-busy="true" /> : races.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"><h2 className="font-bold text-slate-900">Chưa có race entry phù hợp</h2><p className="mt-2 text-sm text-slate-500">Race entry sẽ xuất hiện sau khi Admin phân pairing vào cuộc đua.</p></div> : <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[1280px] w-full text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr>{['Giải và cuộc đua', 'Thời gian', 'Ngựa', 'Chủ ngựa', 'Vị trí xuất phát', 'Race', 'Entry', 'Pairing', 'Kết quả', 'Điểm và thưởng'].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{races.map((race) => <tr key={race.raceEntryId} className="hover:bg-slate-50"><td className="px-4 py-4"><p className="font-bold text-slate-900">{race.tournamentName}</p><p className="mt-1 text-xs text-slate-500">{race.roundName}, cuộc đua {race.raceNumber}</p></td><td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">{formatDate(race.scheduledTime)}</td><td className="whitespace-nowrap px-4 py-4 font-bold text-slate-800">{race.horseName}</td><td className="whitespace-nowrap px-4 py-4 text-slate-700">{race.ownerName}</td><td className="whitespace-nowrap px-4 py-4">{race.postPosition == null ? <span className="text-xs text-slate-400">Chưa có</span> : <span className="font-bold text-slate-800">{race.postPosition}</span>}</td><td className="whitespace-nowrap px-4 py-4"><Badge status={race.raceStatus} /></td><td className="whitespace-nowrap px-4 py-4"><Badge status={race.entryStatus} /></td><td className="whitespace-nowrap px-4 py-4"><Badge status={race.pairingStatus} /></td><td className="whitespace-nowrap px-4 py-4">{race.finishPosition == null ? <span className="text-xs text-slate-400">Chưa có</span> : <div><p className="font-bold text-slate-900">Vị trí {race.finishPosition}</p>{race.finishTime != null && <p className="mt-1 text-xs text-slate-500">Thời gian {race.finishTime}</p>}</div>}</td><td className="whitespace-nowrap px-4 py-4">{race.pointsAwarded == null && race.earningsAwarded == null ? <span className="text-xs text-slate-400">Chưa có</span> : <div>{race.pointsAwarded != null && <p className="font-bold text-slate-900">{race.pointsAwarded} điểm</p>}{race.earningsAwarded != null && <p className="mt-1 text-xs text-emerald-700">{formatCurrency(race.earningsAwarded)}</p>}</div>}</td></tr>)}</tbody></table></div></div>}
      {!loading && totalPages > 1 && <div className="flex items-center justify-center gap-3"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Trang trước</button><span className="text-sm font-semibold text-slate-600">Trang {page} / {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">Trang sau</button></div>}
    </div>
  )
}
