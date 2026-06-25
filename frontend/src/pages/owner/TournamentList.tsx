import React, { useState, useEffect } from 'react'
import { getTournaments, type TournamentResponse } from '../../services/tournamentService'

// ── Màu trạng thái giải đấu ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Upcoming:   { label: 'Sắp diễn ra', bg: 'bg-blue-50',   text: 'text-blue-700',  dot: 'bg-blue-500'  },
  Active:     { label: 'Đang diễn ra',bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500' },
  Completed:  { label: 'Đã kết thúc', bg: 'bg-gray-100',  text: 'text-gray-600',  dot: 'bg-gray-400'  },
  Cancelled:  { label: 'Đã hủy',      bg: 'bg-red-50',    text: 'text-red-700',   dot: 'bg-red-500'   },
  Draft:      { label: 'Nháp',        bg: 'bg-yellow-50', text: 'text-yellow-700',dot: 'bg-yellow-500'},
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
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
function TournamentDetailModal({ tournament, onClose }: { tournament: TournamentResponse; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl flex justify-between items-start">
          <div>
            <p className="text-blue-200 text-xs font-medium uppercase tracking-widest mb-1">Chi tiết giải đấu</p>
            <h2 className="text-xl font-bold leading-tight">{tournament.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors text-2xl leading-none font-light ml-4 mt-0.5"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status + dates */}
          <div className="flex flex-wrap gap-3 items-center">
            <StatusBadge status={tournament.status} />
            <span className="text-sm text-gray-500">
              📅 {formatDate(tournament.startDate)} — {formatDate(tournament.endDate)}
            </span>
          </div>

          {/* Description */}
          {tournament.description && (
            <p className="text-gray-600 text-sm leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">
              {tournament.description}
            </p>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🐴', label: 'Giống ngựa', value: tournament.allowedBreed },
              { icon: '🏟️', label: 'Loại đường đua', value: tournament.trackType },
              { icon: '📏', label: 'Khoảng cách đua', value: `${tournament.raceDistance} m` },
              { icon: '🏆', label: 'Hạng mục', value: tournament.raceCategory },
              { icon: '👤', label: 'Kinh nghiệm jockey tối thiểu', value: `${tournament.minJockeyExperienceYears} năm` },
              { icon: '🐎', label: 'Số ngựa tối đa', value: tournament.maxHorses },
              { icon: '💰', label: 'Tổng giải thưởng', value: formatCurrency(tournament.purseAmount) },
              { icon: '🎫', label: 'Phí tham dự', value: formatCurrency(tournament.entryFeeAmount) },
            ].map(({ icon, label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-0.5">{icon} {label}</p>
                <p className="font-semibold text-gray-800 text-sm">{value}</p>
              </div>
            ))}
          </div>

          {/* Rounds */}
          {tournament.rounds.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-blue-600">🔄</span> Các vòng đấu ({tournament.rounds.length})
              </h3>
              <div className="space-y-2">
                {tournament.rounds.map(round => (
                  <div key={round.roundId} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-800 text-sm">{round.name}</span>
                      <StatusBadge status={round.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      📅 {formatDate(round.scheduledDate)} · {round.races.length} cuộc đua
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prize distributions */}
          {tournament.prizeDistributions.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-yellow-500">🏅</span> Phân chia giải thưởng
              </h3>
              <div className="flex flex-wrap gap-2">
                {tournament.prizeDistributions
                  .sort((a, b) => a.position - b.position)
                  .map(prize => (
                    <div key={prize.position} className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-2 text-center min-w-[80px]">
                      <p className="text-yellow-700 font-bold text-lg">#{prize.position}</p>
                      <p className="text-yellow-600 text-sm font-medium">{prize.percentage}%</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Loading ──────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-5 bg-gray-200 rounded w-2/3" />
        <div className="h-5 bg-gray-100 rounded-full w-20" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-9 bg-gray-100 rounded-lg" />
    </div>
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

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getTournaments()
        setTournaments(data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách giải đấu.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = tournaments.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const statusOptions = ['all', ...Array.from(new Set(tournaments.map(t => t.status)))]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🏆 Danh sách Giải đấu
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Xem tất cả các giải đấu đang diễn ra và sắp tới
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
            <span className="text-blue-600 font-bold text-lg">{filtered.length}</span>
            <span className="text-blue-600 text-sm">giải đấu</span>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Tìm kiếm giải đấu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-700 transition-all"
        >
          <option value="all">Tất cả trạng thái</option>
          {statusOptions.filter(s => s !== 'all').map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
          ))}
        </select>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Không thể tải dữ liệu</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-xl transition-colors text-sm"
          >
            Thử lại
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Không tìm thấy giải đấu</h2>
          <p className="text-gray-500 text-sm">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(t => (
            <div
              key={t.tournamentId}
              className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col"
            >
              {/* Card header */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <h3 className="font-bold text-gray-900 text-base leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
                  {t.name}
                </h3>
                <StatusBadge status={t.status} />
              </div>

              {/* Date */}
              <p className="text-xs text-gray-400 mb-4">
                📅 {formatDate(t.startDate)} — {formatDate(t.endDate)}
              </p>

              {/* Quick info */}
              <div className="grid grid-cols-2 gap-2 mb-4 flex-1">
                <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">🐴 Giống ngựa</p>
                  <p className="text-xs font-semibold text-gray-700 truncate">{t.allowedBreed}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                  <p className="text-xs text-gray-400 mb-0.5">🏟️ Đường đua</p>
                  <p className="text-xs font-semibold text-gray-700 truncate">{t.trackType}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100">
                  <p className="text-xs text-blue-400 mb-0.5">💰 Giải thưởng</p>
                  <p className="text-xs font-bold text-blue-700 truncate">{formatCurrency(t.purseAmount)}</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-2.5 border border-indigo-100">
                  <p className="text-xs text-indigo-400 mb-0.5">🎫 Phí tham dự</p>
                  <p className="text-xs font-bold text-indigo-700 truncate">{formatCurrency(t.entryFeeAmount)}</p>
                </div>
              </div>

              {/* Rounds count */}
              <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                <span>🔄 {t.rounds.length} vòng đấu</span>
                <span>·</span>
                <span>📏 {t.raceDistance} m</span>
                <span>·</span>
                <span>🐎 Tối đa {t.maxHorses} ngựa</span>
              </div>

              {/* CTA */}
              <button
                onClick={() => setSelected(t)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Xem chi tiết →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {selected && <TournamentDetailModal tournament={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export default TournamentList
