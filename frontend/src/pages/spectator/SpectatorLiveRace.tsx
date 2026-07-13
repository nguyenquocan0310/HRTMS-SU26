import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LiveRaceAnimation from '../../components/spectator/LiveRaceAnimation'
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
  completed: 'Kết quả chính thức',
  cancelled: 'Đã hủy',
}

const statusStyle: Record<string, string> = {
  upcoming: 'border-blue-200 bg-blue-50 text-blue-700',
  live: 'border-red-200 bg-red-50 text-red-700',
  unofficial: 'border-amber-200 bg-amber-50 text-amber-700',
  official: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-gray-200 bg-gray-100 text-gray-600',
}

const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('401') || message.includes('Phiên đăng nhập')) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (message.includes('403')) return 'Bạn không có quyền xem cuộc đua này.'
  if (message.includes('404')) return 'Không tìm thấy cuộc đua.'
  if (message.includes('500')) return 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'
  return message || 'Không tải được cuộc đua.'
}

export default function SpectatorLiveRace() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const raceId = Number(searchParams.get('raceId'))
  const validRaceId = Number.isInteger(raceId) && raceId > 0
  const [race, setRace] = useState<RaceLiveStatus | null>(null)
  const [violations, setViolations] = useState<RaceViolation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [violationError, setViolationError] = useState('')
  const [reconnecting, setReconnecting] = useState(false)

  const loadViolations = useCallback(async () => {
    if (!validRaceId) return
    try {
      const result = await getRaceViolations(raceId)
      setViolations(result)
      setViolationError('')
    } catch (err) {
      setViolationError(friendlyError(err))
    }
  }, [raceId, validRaceId])

  const loadInitial = useCallback(async () => {
    if (!validRaceId) {
      setError('Thiếu raceId hợp lệ để theo dõi cuộc đua.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await getRaceLiveStatus(raceId)
      setRace(result)
      setReconnecting(false)
      void loadViolations()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [loadViolations, raceId, validRaceId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInitial(), 0)
    return () => window.clearTimeout(timer)
  }, [loadInitial])

  const normalizedStatus = race?.status.toLowerCase() ?? ''

  useEffect(() => {
    if (!validRaceId || !['upcoming', 'live'].includes(normalizedStatus)) return

    let stopped = false
    let timer: number | undefined
    const interval = normalizedStatus === 'live' ? 1500 : 4000

    const poll = async () => {
      try {
        const result = await getRaceLiveStatus(raceId)
        if (!stopped) {
          setRace(result)
          setReconnecting(false)
        }
      } catch {
        if (!stopped) setReconnecting(true)
      } finally {
        if (!stopped) timer = window.setTimeout(poll, interval)
      }
    }

    timer = window.setTimeout(poll, interval)
    return () => {
      stopped = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [normalizedStatus, raceId, validRaceId])

  useEffect(() => {
    if (!validRaceId || normalizedStatus !== 'live') return

    let stopped = false
    let timer: number | undefined

    const poll = async () => {
      await loadViolations()
      if (!stopped) timer = window.setTimeout(poll, 4000)
    }

    timer = window.setTimeout(poll, 4000)
    return () => {
      stopped = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [loadViolations, normalizedStatus, validRaceId])

  useEffect(() => {
    if (!validRaceId || !['unofficial', 'official', 'completed'].includes(normalizedStatus)) return
    const timer = window.setTimeout(() => void loadViolations(), 0)
    return () => window.clearTimeout(timer)
  }, [loadViolations, normalizedStatus, validRaceId])

  if (!validRaceId) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-700">Thiếu raceId hợp lệ để theo dõi cuộc đua.</p>
        <button type="button" onClick={() => navigate('/spectator')} className="mt-4 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100">Về danh sách cuộc đua</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-col gap-3 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Theo dõi cuộc đua</h1>
          <p className="mt-1 text-sm text-gray-500">Diễn biến trực quan và kết quả được cập nhật từ hệ thống.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/spectator')} className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Danh sách cuộc đua</button>
          <button type="button" onClick={() => void loadInitial()} disabled={loading} className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Làm mới</button>
        </div>
      </header>

      {reconnecting && race && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          Đang kết nối lại. Hệ thống vẫn giữ snapshot gần nhất.
        </div>
      )}

      {error && !race && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void loadInitial()} className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 font-bold hover:bg-red-100">Thử lại</button>
        </div>
      )}

      {loading && !race ? (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
          <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-16 animate-pulse rounded bg-gray-100" />
          <div className="h-16 animate-pulse rounded bg-gray-100" />
          <div className="h-16 animate-pulse rounded bg-gray-100" />
        </div>
      ) : race ? (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Race #{race.raceId}</p>
                <h2 className="mt-1 text-2xl font-black text-gray-900">{statusLabel[normalizedStatus] ?? race.status}</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Lịch đua: {race.scheduledTime ? new Date(race.scheduledTime).toLocaleString('vi-VN') : 'Chưa cập nhật'}
                  {race.actualStartTime ? ` · Bắt đầu thực tế: ${new Date(race.actualStartTime).toLocaleString('vi-VN')}` : ''}
                  {race.raceDurationSeconds != null ? ` · Thời lượng: ${race.raceDurationSeconds} giây` : ''}
                </p>
              </div>
              <span className={`self-start rounded-full border px-3 py-1 text-xs font-bold ${statusStyle[normalizedStatus] ?? 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                {statusLabel[normalizedStatus] ?? race.status}
              </span>
            </div>
            {normalizedStatus === 'cancelled' && <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">Cuộc đua đã bị hủy.</p>}
          </section>

          <LiveRaceAnimation race={race} />

          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-4">
              <h2 className="font-bold text-gray-900">Vi phạm</h2>
              <span className="text-xs text-gray-500">Chỉ hiển thị dữ liệu do trọng tài ghi nhận</span>
            </div>
            {violationError && <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">Không cập nhật được vi phạm: {violationError}</div>}
            {violations.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-500">Chưa ghi nhận vi phạm.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Ngựa/Entry</th><th className="px-5 py-3">Mã</th><th className="px-5 py-3">Hình phạt</th><th className="px-5 py-3">Mô tả</th><th className="px-5 py-3">Thời điểm</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {violations.map((item, index) => (
                      <tr key={item.violationId ?? `${item.raceEntryId}-${index}`}>
                        <td className="px-5 py-4">{item.horseName ?? item.raceEntryId ?? '—'}</td>
                        <td className="px-5 py-4 font-bold">{item.violationCode || '—'}</td>
                        <td className="px-5 py-4">{item.penalty || '—'}</td>
                        <td className="px-5 py-4 text-gray-500">{item.description || '—'}</td>
                        <td className="px-5 py-4 text-gray-500">{item.loggedAt ? new Date(item.loggedAt).toLocaleString('vi-VN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
