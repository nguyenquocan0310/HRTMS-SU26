import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LiveRaceAnimation from '../../components/spectator/LiveRaceAnimation'
import HorseRaceStage from '../../features/live-race/HorseRaceStage'
import { getTournaments } from '../../services/tournamentService'
import {
  getRaceLiveStatus,
  getRaceViolations,
  type RaceLiveStatus,
  type RaceViolation,
} from '../../services/spectatorService'

const statusLabel: Record<string, string> = {
  upcoming: 'Sắp diễn ra',
  'pre-race': 'Chờ xuất phát',
  live: 'Đang diễn ra',
  unofficial: 'Kết quả sơ bộ',
  official: 'Kết quả chính thức',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy',
}

interface LiveRaceOption {
  raceId: number
  raceNumber: number
  scheduledTime: string
  status: string
  tournamentName: string
  roundName: string
}

type RaceLoadMode = 'initial' | 'manual' | 'poll'

export default function SpectatorLiveRace() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const raceId = Number(searchParams.get('raceId'))
  const validRaceId = Number.isInteger(raceId) && raceId > 0
  const [race, setRace] = useState<RaceLiveStatus | null>(null)
  const [violations, setViolations] = useState<RaceViolation[]>([])
  const [raceOptions, setRaceOptions] = useState<LiveRaceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const mountedRef = useRef(false)
  const currentRaceIdRef = useRef<number | null>(validRaceId ? raceId : null)
  const activeRequestRef = useRef<{ raceId: number; token: symbol } | null>(null)

  const load = useCallback(async (mode: RaceLoadMode = 'poll') => {
    if (!validRaceId) return
    if (activeRequestRef.current?.raceId === raceId) return

    const token = Symbol(`race-${raceId}-${mode}`)
    activeRequestRef.current = { raceId, token }
    try {
      if (mode === 'initial') setLoading(true)
      if (mode === 'manual') setRefreshing(true)
      if (mode !== 'poll') setError('')

      const [raceResult, violationResult] = await Promise.allSettled([
        getRaceLiveStatus(raceId),
        getRaceViolations(raceId),
      ])

      if (!mountedRef.current || currentRaceIdRef.current !== raceId) return

      if (violationResult.status === 'fulfilled') setViolations(violationResult.value)
      if (raceResult.status === 'rejected') throw raceResult.reason
      setRace(raceResult.value)
      setError('')
    } catch (err) {
      if (
        mode !== 'poll'
        && mountedRef.current
        && currentRaceIdRef.current === raceId
      ) {
        setError(err instanceof Error ? err.message : 'Không tải được cuộc đua.')
      }
    } finally {
      if (activeRequestRef.current?.token === token) activeRequestRef.current = null
      if (mountedRef.current && currentRaceIdRef.current === raceId) {
        if (mode === 'initial') setLoading(false)
        if (mode === 'manual') setRefreshing(false)
      }
    }
  }, [raceId, validRaceId])

  const loadRaceOptions = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const tournaments = await getTournaments()
      const options = tournaments.flatMap((tournament) =>
        tournament.rounds.flatMap((round) =>
          round.races.map((item) => ({
            raceId: item.raceId,
            raceNumber: item.raceNumber,
            scheduledTime: item.scheduledTime,
            status: item.status,
            tournamentName: tournament.name,
            roundName: round.name,
          }))
        )
      )
      setRaceOptions(options)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách cuộc đua.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      currentRaceIdRef.current = null
    }
  }, [])

  useEffect(() => {
    currentRaceIdRef.current = validRaceId ? raceId : null
  }, [raceId, validRaceId])

  useEffect(() => {
    void Promise.resolve().then(() => validRaceId ? load('initial') : loadRaceOptions())
  }, [load, loadRaceOptions, validRaceId])

  useEffect(() => {
    if (!validRaceId) return
    const timer = window.setInterval(() => void load('poll'), 4000)
    return () => window.clearInterval(timer)
  }, [load, validRaceId])

  const normalizedStatus = race?.status.toLowerCase() ?? ''
  const sortedRaceOptions = useMemo(
    () => [...raceOptions].sort((left, right) => new Date(right.scheduledTime).getTime() - new Date(left.scheduledTime).getTime()),
    [raceOptions]
  )

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-3 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-3xl font-extrabold text-gray-900">Theo dõi cuộc đua</h1><p className="mt-1 text-sm text-gray-500">Trạng thái và kết quả được cập nhật từ hệ thống.</p></div>
        <button type="button" onClick={() => validRaceId ? void load('manual') : void loadRaceOptions()} disabled={loading || refreshing} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50">{refreshing ? 'Đang làm mới...' : 'Làm mới'}</button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => validRaceId ? void load('manual') : void loadRaceOptions()} className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 font-bold text-red-700">Thử lại</button></div>}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">Đang tải cuộc đua...</div>
      ) : !validRaceId ? (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4 sm:px-6"><h2 className="font-black text-gray-900">Chọn cuộc đua để theo dõi</h2><p className="mt-1 text-sm text-gray-500">Trạng thái và thời gian bên dưới được lấy trực tiếp từ hệ thống.</p></div>
          {sortedRaceOptions.length === 0 ? <div className="p-12 text-center"><p className="font-bold text-gray-800">Hiện chưa có cuộc đua nào</p><p className="mt-1 text-sm text-gray-500">Danh sách sẽ được cập nhật khi hệ thống có lịch thi đấu.</p></div> : <div className="divide-y divide-gray-100">{sortedRaceOptions.map((option) => {
            const status = option.status.toLowerCase()
            return <article key={option.raceId} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-amber-700">{option.tournamentName} · {option.roundName}</p><h3 className="mt-1 font-black text-gray-950">Cuộc đua #{option.raceNumber}</h3><p className="mt-1 text-sm text-gray-500">{new Date(option.scheduledTime).toLocaleString('vi-VN')}</p></div>
              <div className="flex flex-wrap items-center gap-3"><span className={`rounded-full border px-3 py-1 text-xs font-bold ${status === 'live' ? 'border-red-200 bg-red-50 text-red-700' : status === 'official' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{statusLabel[status] ?? option.status}</span><button type="button" onClick={() => navigate(`/spectator/live-race?raceId=${option.raceId}`)} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700">Theo dõi cuộc đua</button></div>
            </article>
          })}</div>}
        </section>
      ) : race ? (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-gray-400">Race #{race.raceId}</p><h2 className="mt-1 text-2xl font-black text-gray-900">{statusLabel[normalizedStatus] ?? race.status}</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${normalizedStatus === 'live' ? 'border-red-200 bg-red-50 text-red-700' : normalizedStatus === 'official' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{statusLabel[normalizedStatus] ?? race.status}</span></div>
            <p className="mt-3 text-sm text-gray-500">Bắt đầu: {race.actualStartTime ? new Date(race.actualStartTime).toLocaleString('vi-VN') : 'Chưa bắt đầu'}</p>
          </section>

          {race.entries.length > 0 && (
            <HorseRaceStage key={race.raceId} race={race} fallback={<LiveRaceAnimation race={race} />} />
          )}

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
