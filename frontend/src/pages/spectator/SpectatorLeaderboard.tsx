import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getHorseLeaderboard,
  getJockeyLeaderboard,
  type HorseLeaderboardEntry,
  type JockeyLeaderboardEntry,
  type LeaderboardMode,
} from '../../services/leaderboardService'
import { getTournaments, type TournamentResponse } from '../../services/tournamentService'

type LeaderboardTab = 'horses' | 'jockeys'
type LeaderboardEntry = HorseLeaderboardEntry | JockeyLeaderboardEntry

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

const numberFormatter = new Intl.NumberFormat('vi-VN')

const safeNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const getEntryName = (entry: LeaderboardEntry, tab: LeaderboardTab) => {
  const name = tab === 'horses'
    ? (entry as HorseLeaderboardEntry).horseName
    : (entry as JockeyLeaderboardEntry).jockeyName

  return name?.trim() || 'Chưa cập nhật'
}

const getEntryId = (entry: LeaderboardEntry, tab: LeaderboardTab) =>
  tab === 'horses'
    ? (entry as HorseLeaderboardEntry).horseId
    : (entry as JockeyLeaderboardEntry).jockeyId

export default function SpectatorLeaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('horses')
  const [mode, setMode] = useState<LeaderboardMode>('points')
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [tournamentsLoading, setTournamentsLoading] = useState(true)
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [tournamentError, setTournamentError] = useState('')
  const [leaderboardError, setLeaderboardError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  const loadTournaments = useCallback(async () => {
    try {
      setTournamentsLoading(true)
      setTournamentError('')
      const list = await getTournaments()
      setTournaments(list)
      setSelectedTournamentId((currentId) => {
        if (currentId != null && list.some((item) => item.tournamentId === currentId)) {
          return currentId
        }
        return list[0]?.tournamentId ?? null
      })
    } catch (error) {
      setTournaments([])
      setSelectedTournamentId(null)
      setTournamentError(
        error instanceof Error ? error.message : 'Không tải được danh sách giải đấu.'
      )
    } finally {
      setTournamentsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadTournaments)
  }, [loadTournaments])

  useEffect(() => {
    if (selectedTournamentId == null) {
      return
    }

    const controller = new AbortController()

    const loadLeaderboard = async () => {
      try {
        setLeaderboardLoading(true)
        setLeaderboardError('')
        const data = activeTab === 'horses'
          ? await getHorseLeaderboard(selectedTournamentId, mode, controller.signal)
          : await getJockeyLeaderboard(selectedTournamentId, mode, controller.signal)

        if (!controller.signal.aborted) {
          setEntries(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setEntries([])
        setLeaderboardError(
          error instanceof Error ? error.message : 'Không tải được bảng xếp hạng.'
        )
      } finally {
        if (!controller.signal.aborted) {
          setLeaderboardLoading(false)
        }
      }
    }

    void Promise.resolve().then(loadLeaderboard)
    return () => controller.abort()
  }, [activeTab, mode, retryKey, selectedTournamentId])

  const selectedTournament = useMemo(
    () => tournaments.find((item) => item.tournamentId === selectedTournamentId),
    [selectedTournamentId, tournaments]
  )

  const metricLabel = mode === 'points' ? 'Điểm' : 'Thu nhập'
  const entityLabel = activeTab === 'horses' ? 'Ngựa' : 'Kỵ sĩ'

  return (
    <div className="space-y-7 pb-12">
      <header className="border-b border-gray-200 pb-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              Thành tích chính thức
            </p>
            <h1 className="mt-1 text-3xl font-extrabold text-gray-900">Bảng xếp hạng</h1>
            <p className="mt-1 text-sm text-gray-500">
              Theo dõi thành tích của ngựa và kỵ sĩ sau các cuộc đua chính thức.
            </p>
          </div>
          {selectedTournament && (
            <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
              {selectedTournament.name}
            </span>
          )}
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex gap-2" role="tablist" aria-label="Loại bảng xếp hạng">
            {([
              { value: 'horses' as const, label: 'Ngựa', icon: '🐎' },
              { value: 'jockeys' as const, label: 'Kỵ sĩ', icon: '🏇' },
            ]).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
                  activeTab === tab.value
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 border-b border-gray-100 bg-gray-50/70 p-4 sm:grid-cols-2 sm:p-6">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Giải đấu</span>
            <select
              value={selectedTournamentId ?? ''}
              disabled={tournamentsLoading || tournaments.length === 0}
              onChange={(event) => setSelectedTournamentId(Number(event.target.value))}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              {tournaments.length === 0 && (
                <option value="">
                  {tournamentsLoading ? 'Đang tải giải đấu...' : 'Chưa có giải đấu'}
                </option>
              )}
              {tournaments.map((tournament) => (
                <option key={tournament.tournamentId} value={tournament.tournamentId}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Xếp hạng theo
            </legend>
            <div className="grid grid-cols-2 rounded-xl border border-gray-300 bg-white p-1">
              {([
                { value: 'points' as const, label: 'Điểm' },
                { value: 'earnings' as const, label: 'Thu nhập' },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                    mode === option.value
                      ? 'bg-amber-100 text-amber-800 shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {tournamentError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl" aria-hidden="true">
              ⚠️
            </div>
            <p className="font-bold text-gray-900">Không thể tải danh sách giải đấu</p>
            <p className="max-w-md text-sm text-red-600">{tournamentError}</p>
            <button
              type="button"
              onClick={() => void loadTournaments()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700"
            >
              Thử lại
            </button>
          </div>
        ) : leaderboardLoading || tournamentsLoading ? (
          <div className="overflow-x-auto" aria-label="Đang tải bảng xếp hạng" aria-busy="true">
            <div className="min-w-[680px] animate-pulse">
              <div className="grid grid-cols-6 gap-4 bg-gray-50 px-6 py-4">
                {[...Array(6)].map((_, index) => <div key={index} className="h-3 rounded bg-gray-200" />)}
              </div>
              {[...Array(5)].map((_, row) => (
                <div key={row} className="grid grid-cols-6 gap-4 border-t border-gray-100 px-6 py-5">
                  {[...Array(6)].map((_, column) => <div key={column} className="h-4 rounded bg-gray-100" />)}
                </div>
              ))}
            </div>
          </div>
        ) : leaderboardError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl" aria-hidden="true">
              ⚠️
            </div>
            <p className="font-bold text-gray-900">Không thể tải bảng xếp hạng</p>
            <p className="max-w-md text-sm text-red-600">{leaderboardError}</p>
            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700"
            >
              Thử lại
            </button>
          </div>
        ) : selectedTournamentId == null || entries.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-2xl" aria-hidden="true">
              🏆
            </div>
            <p className="font-bold text-gray-900">Chưa có dữ liệu xếp hạng</p>
            <p className="max-w-lg text-sm leading-6 text-gray-500">
              Chưa có dữ liệu xếp hạng. Kết quả sẽ được cập nhật sau khi cuộc đua kết thúc.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3.5">Hạng</th>
                  <th className="px-6 py-3.5">{entityLabel}</th>
                  <th className="px-6 py-3.5 text-center">Số cuộc đua</th>
                  <th className="px-6 py-3.5 text-center">Số lần thắng</th>
                  <th className="px-6 py-3.5 text-center">Tỷ lệ thắng</th>
                  <th className="px-6 py-3.5 text-right">{metricLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, index) => {
                  const rank = safeNumber(entry.rank) || index + 1
                  const winRate = Math.max(0, safeNumber(entry.winRate))
                  const metric = mode === 'points'
                    ? numberFormatter.format(safeNumber(entry.totalPoints))
                    : currencyFormatter.format(safeNumber(entry.totalEarnings))

                  return (
                    <tr key={`${activeTab}-${getEntryId(entry, activeTab)}-${rank}`} className="hover:bg-amber-50/30">
                      <td className="px-6 py-4">
                        <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-black ${
                          rank === 1
                            ? 'bg-amber-100 text-amber-800'
                            : rank === 2
                              ? 'bg-slate-100 text-slate-700'
                              : rank === 3
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-50 text-gray-600'
                        }`}>
                          {rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">{getEntryName(entry, activeTab)}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{numberFormatter.format(safeNumber(entry.races))}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{numberFormatter.format(safeNumber(entry.wins))}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{numberFormatter.format(winRate * 100)}%</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-black text-amber-700">{metric}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
