import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getRaceLiveStatus,
  getRaceViolations,
  type RaceLiveStatus,
  type RaceViolation,
} from '../../services/spectatorService'

const statusLabel: Record<string, string> = {
  upcoming: 'Sắp diễn ra',
  live: 'Đang diễn ra',
  unofficial: 'Kết quả tạm thời',
  official: 'Kết quả chính thức',
  cancelled: 'Đã hủy',
}

export default function SpectatorLiveRace() {
  const [searchParams] = useSearchParams()
  const raceId = Number(searchParams.get('raceId'))
  const validRaceId = Number.isInteger(raceId) && raceId > 0
  const [race, setRace] = useState<RaceLiveStatus | null>(null)
  const [violations, setViolations] = useState<RaceViolation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (showLoading = false) => {
    if (!validRaceId) {
      setError('Thiếu raceId hợp lệ để theo dõi cuộc đua.')
      setLoading(false)
      return
    }
    try {
      if (showLoading) setLoading(true)
      setError('')
      const [raceResult, violationResult] = await Promise.all([
        getRaceLiveStatus(raceId),
        getRaceViolations(raceId),
      ])
      setRace(raceResult)
      setViolations(violationResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được cuộc đua.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
  }, [raceId])

  useEffect(() => {
    if (!validRaceId || race?.status.toLowerCase() !== 'live') return
    const timer = window.setInterval(() => load(false), 4000)
    return () => window.clearInterval(timer)
  }, [raceId, race?.status])

  const normalizedStatus = race?.status.toLowerCase() ?? ''

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-3 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-3xl font-extrabold text-gray-900">Theo dõi cuộc đua</h1><p className="mt-1 text-sm text-gray-500">Trạng thái và kết quả được cập nhật từ hệ thống.</p></div>
        <button type="button" onClick={() => load(true)} disabled={!validRaceId || loading} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50">Làm mới</button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">Đang tải cuộc đua...</div>
      ) : race ? (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-gray-400">Race #{race.raceId}</p><h2 className="mt-1 text-2xl font-black text-gray-900">{statusLabel[normalizedStatus] ?? race.status}</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${normalizedStatus === 'live' ? 'border-red-200 bg-red-50 text-red-700' : normalizedStatus === 'official' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{statusLabel[normalizedStatus] ?? race.status}</span></div>
            <p className="mt-3 text-sm text-gray-500">Bắt đầu: {race.actualStartTime ? new Date(race.actualStartTime).toLocaleString('vi-VN') : 'Chưa bắt đầu'} {race.raceDurationSeconds != null && `· Thời lượng ${race.raceDurationSeconds} giây`}</p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-gray-900">Danh sách thi đấu</h2></div>
            {race.entries.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Chưa có entry trong cuộc đua.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Post</th><th className="px-5 py-3">Ngựa / Kỵ sĩ</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thứ hạng</th><th className="px-5 py-3">Thời gian</th></tr></thead><tbody className="divide-y divide-gray-100">{race.entries.map((entry) => <tr key={entry.raceEntryId}><td className="px-5 py-4 font-bold text-gray-500">{entry.postPosition ?? '—'}</td><td className="px-5 py-4"><p className="font-bold text-gray-900">{entry.horseName}</p><p className="text-xs text-gray-400">{entry.jockeyName}</p></td><td className="px-5 py-4 text-gray-600">{entry.isWithdrawn ? 'Đã rút' : entry.status}</td><td className="px-5 py-4 font-bold">{entry.finishPosition ?? '—'}</td><td className="px-5 py-4">{entry.finishTime != null ? `${entry.finishTime} giây` : '—'}</td></tr>)}</tbody></table></div>}
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-gray-900">Vi phạm</h2></div>{violations.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Chưa có vi phạm nào được ghi nhận.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Ngựa/Entry</th><th className="px-5 py-3">Mã</th><th className="px-5 py-3">Hình phạt</th><th className="px-5 py-3">Mô tả</th></tr></thead><tbody className="divide-y divide-gray-100">{violations.map((item, index) => <tr key={item.violationId ?? index}><td className="px-5 py-4">{item.horseName ?? item.raceEntryId ?? '—'}</td><td className="px-5 py-4 font-bold">{item.violationCode || '—'}</td><td className="px-5 py-4">{item.penalty || '—'}</td><td className="px-5 py-4 text-gray-500">{item.description || '—'}</td></tr>)}</tbody></table></div>}</section>
        </>
      ) : null}
    </div>
  )
}
