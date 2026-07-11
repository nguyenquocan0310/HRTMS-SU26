import React, { useState, useEffect, useCallback } from 'react'
import {
  getTournaments,
  registerForTournament,
  getMyTournamentParticipations,
  type TournamentResponse,
  type ParticipationResponse,
} from '../../services/tournamentService'

// ── Màu trạng thái giải đấu ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Upcoming:             { label: 'Sắp diễn ra',   bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  Active:               { label: 'Đang diễn ra',   bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500'   },
  Completed:            { label: 'Đã kết thúc',    bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400'    },
  Cancelled:            { label: 'Đã hủy',          bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  Draft:                { label: 'Nháp',             bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-500'  },
  'Open Registration':  { label: 'Mở đăng ký',     bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.text}`}
      style={{ borderColor: 'transparent' }}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

// ── Modal Chi tiết ────────────────────────────────────────────────────────────
interface TournamentDetailModalProps {
  tournament: TournamentResponse
  isRegistered: boolean
  onClose: () => void
  onRegister: (tournamentId: number) => Promise<void>
}

function TournamentDetailModal({
  tournament,
  isRegistered,
  onClose,
  onRegister,
}: TournamentDetailModalProps) {
  const [registering, setRegistering] = useState(false)
  const [regMessage, setRegMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canRegister = tournament.status === 'Open Registration'

  const handleRegister = async () => {
    setRegistering(true)
    setRegMessage(null)
    try {
      await onRegister(tournament.tournamentId)
      // Message sẽ được set từ parent sau khi refetch, không cần set ở đây
    } catch (err: unknown) {
      setRegMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng thử lại.',
      })
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[88vh] overflow-y-auto border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between rounded-t-xl">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-0.5">Chi tiết giải đấu</p>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{tournament.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none font-light ml-4 mt-0.5"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status + dates */}
          <div className="flex flex-wrap gap-3 items-center">
            <StatusBadge status={tournament.status} />
            <span className="text-xs text-gray-500">
              {formatDate(tournament.startDate)} — {formatDate(tournament.endDate)}
            </span>
          </div>

          {/* Description */}
          {tournament.description && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
              {tournament.description}
            </p>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Giống ngựa',              value: tournament.allowedBreed },
              { label: 'Loại đường đua',           value: tournament.trackType },
              { label: 'Khoảng cách đua',          value: `${tournament.raceDistance} m` },
              { label: 'Hạng mục',                 value: tournament.raceCategory },
              { label: 'KN jockey tối thiểu',      value: `${tournament.minJockeyExperienceYears} năm` },
              { label: 'Số ngựa tối đa',           value: tournament.maxHorses },
              { label: 'Tổng giải thưởng',         value: formatCurrency(tournament.purseAmount) },
              { label: 'Phí tham dự',              value: formatCurrency(tournament.entryFeeAmount) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Rounds */}
          {tournament.rounds.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Các vòng đấu ({tournament.rounds.length})
              </p>
              <div className="space-y-1.5">
                {tournament.rounds.map(round => (
                  <div key={round.roundId} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2.5 bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{round.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(round.scheduledDate)} · {round.races.length} cuộc đua
                      </p>
                    </div>
                    <StatusBadge status={round.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prize distributions */}
          {tournament.prizeDistributions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Phân chia giải thưởng
              </p>
              <div className="flex flex-wrap gap-2">
                {tournament.prizeDistributions
                  .sort((a, b) => a.position - b.position)
                  .map(prize => (
                    <div key={prize.position} className="bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-2 text-center min-w-[72px]">
                      <p className="text-yellow-700 font-bold text-sm">#{prize.position}</p>
                      <p className="text-yellow-600 text-xs font-medium">{prize.percentage}%</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Register section */}
          {canRegister && (
            <div className="border-t border-gray-100 pt-4">
              {regMessage && (
                <div
                  className={`mb-3 px-3 py-2.5 rounded-lg text-sm font-medium border ${
                    regMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {regMessage.text}
                </div>
              )}

              {isRegistered ? (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 font-semibold py-2.5 rounded-lg text-sm cursor-not-allowed"
                >
                  Đã đăng ký
                </button>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:cursor-not-allowed"
                >
                  {registering ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Đang đăng ký...
                    </>
                  ) : (
                    'Đăng ký tham gia'
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Loading ──────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-3.5 bg-gray-200 rounded w-2/3" /></td>
      <td className="px-4 py-3"><div className="h-5 bg-gray-100 rounded-full w-24" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-20" /></td>
      <td className="px-4 py-3"><div className="h-3 bg-gray-100 rounded w-24" /></td>
      <td className="px-4 py-3"><div className="h-7 bg-gray-100 rounded-lg w-24" /></td>
    </tr>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
const TournamentList: React.FC = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<TournamentResponse | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  // Set chứa tournamentId mà Owner đã đăng ký
  const [registeredIds, setRegisteredIds] = useState<Set<number>>(new Set())
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null)

  // Fetch danh sách giải đã đăng ký
  const fetchParticipations = useCallback(async () => {
    try {
      const list = await getMyTournamentParticipations()
      setRegisteredIds(new Set(list.map((p: ParticipationResponse) => p.tournamentId)))
    } catch {
      // Không hiển thị lỗi nếu API participations fail — không chặn UX
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [data] = await Promise.all([getTournaments(), fetchParticipations()])
        setTournaments(data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách giải đấu.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchParticipations])

  // Xử lý đăng ký tham gia giải
  const handleRegister = useCallback(async (tournamentId: number) => {
    const participation = await registerForTournament(tournamentId)
    // Refetch để đảm bảo trạng thái luôn đồng bộ với server
    await fetchParticipations()
    // Hiển thị thông báo thành công tương ứng với status trả về
    if (participation.status === 'Approved') {
      setRegSuccessMsg('Bạn đã được duyệt tham gia giải.')
    } else {
      setRegSuccessMsg('Đăng ký thành công, đang chờ Admin duyệt.')
    }
    // Xóa thông báo sau 5 giây
    setTimeout(() => setRegSuccessMsg(null), 5000)
  }, [fetchParticipations])

  const filtered = tournaments.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const statusOptions = ['all', ...Array.from(new Set(tournaments.map(t => t.status)))]

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Danh sách giải đấu</h1>
          <p className="text-base text-slate-500 mt-2">Xem và đăng ký tham gia các giải đấu</p>
        </div>
        {!loading && (
          <span className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
            {filtered.length} giải đấu
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <input
          type="text"
          placeholder="Tìm kiếm giải đấu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700"
        >
          <option value="all">Tất cả trạng thái</option>
          {statusOptions.filter(s => s !== 'all').map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
        {error ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-1">Không thể tải dữ liệu</p>
            <p className="text-xs text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tên giải</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Thời gian</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phí tham dự</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Giải thưởng</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-gray-400 text-sm">
                      Không tìm thấy giải đấu nào
                    </td>
                  </tr>
                ) : (
                  filtered.map(t => (
                    <tr key={t.tournamentId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.allowedBreed} · {t.raceDistance}m · {t.rounds.length} vòng
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                        {registeredIds.has(t.tournamentId) && (
                          <p className="text-xs text-emerald-600 font-medium mt-1">Đã đăng ký</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {formatDate(t.startDate)}<br />
                        <span className="text-gray-400">→ {formatDate(t.endDate)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-700">
                        {formatCurrency(t.entryFeeAmount)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-blue-700">
                        {formatCurrency(t.purseAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(t)}
                          className="px-3.5 py-2 text-xs font-bold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors whitespace-nowrap"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast success */}
      {regSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-700 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-300" />
          {regSuccessMsg}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <TournamentDetailModal
          tournament={selected}
          isRegistered={registeredIds.has(selected.tournamentId)}
          onClose={() => setSelected(null)}
          onRegister={handleRegister}
        />
      )}
    </div>
  )
}

export default TournamentList
