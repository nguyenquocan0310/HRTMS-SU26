import { useMemo } from 'react'
import { FiFlag } from 'react-icons/fi'
import { GiHorseHead } from 'react-icons/gi'
import type { LiveRaceEntry, RaceLiveStatus } from '../../services/spectatorService'
import { useLiveRaceProgress } from '../../hooks/useLiveRaceProgress'
import SpectatorRaceStatusBadge from './SpectatorRaceStatusBadge'

interface LiveRaceAnimationProps {
  race: RaceLiveStatus
}

const laneColors = [
  'border-blue-300 bg-blue-600',
  'border-emerald-300 bg-emerald-600',
  'border-amber-300 bg-amber-600',
  'border-rose-300 bg-rose-600',
  'border-violet-300 bg-violet-600',
  'border-cyan-300 bg-cyan-600',
]

const entryState = (entry: LiveRaceEntry) => {
  const status = entry.status.toLowerCase()
  if (entry.isWithdrawn) return 'Đã rút'
  if (status === 'disqualified') return 'Đã loại'
  if (status === 'cancelled') return 'Đã hủy'
  return entry.status
}

const isInactive = (entry: LiveRaceEntry) => {
  const status = entry.status.toLowerCase()
  return entry.isWithdrawn || status === 'cancelled' || status === 'disqualified'
}

const formatClock = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function LiveRaceAnimation({ race }: LiveRaceAnimationProps) {
  const { elapsedSeconds, baseProgress, countdownSeconds, hasTimingData, progressByEntry } = useLiveRaceProgress(race)
  const status = race.status.toLowerCase()
  const isLive = status === 'live'
  const hasBackendResult = ['unofficial', 'official', 'completed'].includes(status)
  const rankingLabel = status === 'unofficial'
    ? 'Kết quả sơ bộ'
    : status === 'official' || status === 'completed'
      ? 'Kết quả chính thức'
    : isLive
      ? 'Diễn biến mô phỏng'
      : status === 'cancelled'
        ? 'Cuộc đua đã hủy'
        : 'Chờ cuộc đua'

  const entries = useMemo(
    () => [...race.entries].sort((a, b) => {
      if (a.postPosition == null && b.postPosition == null) return a.raceEntryId - b.raceEntryId
      if (a.postPosition == null) return 1
      if (b.postPosition == null) return -1
      return a.postPosition - b.postPosition
    }),
    [race.entries]
  )

  const ranking = useMemo(() => [...entries].sort((a, b) => {
    if (hasBackendResult) {
      if (a.finishPosition == null && b.finishPosition == null) return 0
      if (a.finishPosition == null) return 1
      if (b.finishPosition == null) return -1
      return a.finishPosition - b.finishPosition
    }
    return (progressByEntry[b.raceEntryId] ?? 0) - (progressByEntry[a.raceEntryId] ?? 0)
  }), [entries, hasBackendResult, progressByEntry])

  if (entries.length === 0) {
    return <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Chưa có entry trong cuộc đua.</div>
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Đường đua trực tiếp</h2>
            <p className="mt-1 text-xs text-gray-500">
              {isLive ? 'Chuyển động đang mô phỏng theo thời gian hệ thống; kết quả cuối do backend xác định.' : 'Vị trí và kết quả được đồng bộ từ hệ thống.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {status === 'upcoming' && (
              <>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">Chờ trọng tài bắt đầu cuộc đua</span>
                {countdownSeconds != null && countdownSeconds > 0 && (
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700">Bắt đầu sau {formatClock(countdownSeconds)}</span>
                )}
              </>
            )}
            {status === 'pre-race' && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">Chờ trọng tài cho xuất phát</span>
            )}
            {isLive && (
              <>
                <SpectatorRaceStatusBadge status={race.status} label={`Đã chạy ${formatClock(elapsedSeconds)}`} />
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700">{Math.round(baseProgress * 100)}%</span>
              </>
            )}
          </div>
        </div>

        {isLive && !hasTimingData && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">Đang chờ thời điểm bắt đầu và thời lượng cuộc đua từ hệ thống.</div>
        )}
        {status === 'cancelled' && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">Cuộc đua đã bị hủy. Animation đã dừng.</div>
        )}
        {status === 'unofficial' && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">Kết quả sơ bộ do trọng tài xác nhận, đang chờ công bố chính thức.</div>
        )}

        <div className="overflow-x-auto p-4">
          <div className="min-w-[760px] space-y-2">
            {entries.map((entry, index) => {
              const inactive = isInactive(entry)
              const progress = progressByEntry[entry.raceEntryId] ?? 0
              const color = laneColors[index % laneColors.length]

              return (
                <div key={entry.raceEntryId} className="grid grid-cols-[190px_minmax(520px,1fr)] items-stretch overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3 border-r border-gray-200 bg-white px-3 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-xs font-black text-gray-700">{entry.postPosition ?? '—'}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{entry.horseName || 'Chưa có tên'}</p>
                      <p className="truncate text-xs text-gray-500">{entry.jockeyName || 'Chưa có Jockey'}</p>
                    </div>
                  </div>

                  <div className="relative h-[62px] overflow-hidden bg-[#e7decf]">
                    <div className="absolute inset-y-0 left-[4%] border-l-2 border-dashed border-gray-700/50" />
                    <div className="absolute inset-y-0 left-[94%] flex items-start border-l-2 border-dashed border-gray-900/70 pt-1">
                      <FiFlag className="-ml-0.5 h-4 w-4 text-gray-900" aria-hidden="true" />
                    </div>
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/80" />
                    <div
                      className="pointer-events-none absolute left-[4%] top-1/2 w-[90%] transition-transform duration-200 ease-linear motion-reduce:transition-none"
                      style={{ transform: `translate(${progress * 100}%, -50%)` }}
                    >
                      <div
                        className={`flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 text-white shadow-sm ${inactive ? 'border-gray-300 bg-gray-400' : color}`}
                        title={`${entry.horseName} - ${Math.round(progress * 100)}%`}
                      >
                        <GiHorseHead className="h-5 w-5" aria-hidden="true" />
                      </div>
                    </div>
                    {inactive && (
                      <span className="absolute right-12 top-1/2 -translate-y-1/2 rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600">{entryState(entry)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-gray-900">Bảng xếp hạng</h2>
            <SpectatorRaceStatusBadge status={race.status} label={rankingLabel} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-5 py-3">Hạng</th><th className="px-5 py-3">Post</th><th className="px-5 py-3">Ngựa / Kỵ sĩ</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Thời gian</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ranking.map((entry, index) => (
                <tr key={entry.raceEntryId}>
                  <td className="px-5 py-4 font-black text-gray-900">{hasBackendResult ? entry.finishPosition ?? '—' : isLive && !isInactive(entry) ? index + 1 : '—'}</td>
                  <td className="px-5 py-4 font-semibold text-gray-500">{entry.postPosition ?? '—'}</td>
                  <td className="px-5 py-4"><p className="font-bold text-gray-900">{entry.horseName}</p><p className="text-xs text-gray-500">{entry.jockeyName}</p></td>
                  <td className="px-5 py-4 text-gray-600">{entryState(entry)}</td>
                  <td className="px-5 py-4 text-gray-600">{entry.finishTime != null ? `${entry.finishTime} giây` : hasBackendResult ? 'Chờ kết quả' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
