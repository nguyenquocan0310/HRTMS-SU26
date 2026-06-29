import React, { useState, useEffect, useCallback } from 'react'
import {
  getTournaments,
  registerForTournament,
  getMyTournamentParticipations,
  type TournamentResponse,
  type ParticipationResponse,
} from '../../services/tournamentService'

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Upcoming:            { label: 'Sắp diễn ra',  bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  Active:              { label: 'Đang diễn ra', bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500'   },
  Completed:           { label: 'Đã kết thúc',  bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400'    },
  Cancelled:           { label: 'Đã hủy',       bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  Draft:               { label: 'Nháp',          bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-500'  },
  'Open Registration': { label: 'Mở đăng ký',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}

// ─── Registration status button config ───────────────────────────────────────
// Dùng Record<string> thay vì union type — BE có thể trả bất kỳ status nào.
const REG_STATUS: Record<string, { label: string; cls: string }> = {
  // Legacy statuses
  Pending:      { label: '⏳ Đang chờ duyệt',  cls: 'bg-yellow-50 border-yellow-300 text-yellow-700 cursor-not-allowed' },
  Approved:     { label: '✅ Đã được duyệt', cls: 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-not-allowed' },
  Rejected:     { label: '❌ Bị từ chối',    cls: 'bg-red-50 border-red-300 text-red-700 cursor-not-allowed' },
  // Screening statuses từ BE
  ManualReview: { label: '⏳ Đang chờ duyệt',  cls: 'bg-yellow-50 border-yellow-300 text-yellow-700 cursor-not-allowed' },
  AutoEligible: { label: '✅ Đã được duyệt', cls: 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-not-allowed' },
  AutoRejected: { label: '❌ Bị từ chối',    cls: 'bg-red-50 border-red-300 text-red-700 cursor-not-allowed' },
}

/** Trả về config cho status bất kỳ — fallback an toàn, không bao giờ undefined. */
function getRegStatus(status: string) {
  return (
    REG_STATUS[status] ?? {
      label: `ℹ️ ${status}`,
      cls: 'bg-gray-50 border-gray-300 text-gray-700 cursor-not-allowed',
    }
  )
}

/** Trả true nếu status thuộc nhóm bị từ chối — dùng để hiển thị lý do. */
function isRejectedStatus(status: string) {
  return status === 'Rejected' || status === 'AutoRejected'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
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

// ─── Detail Modal ─────────────────────────────────────────────────────────────
interface DetailModalProps {
  tournament: TournamentResponse
  participation: ParticipationResponse | null
  onClose: () => void
  onRegister: (id: number) => Promise<void>
}

function TournamentDetailModal({ tournament, participation, onClose, onRegister }: DetailModalProps) {
  const [registering, setRegistering] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isOpen = tournament.status === 'Open Registration'
  // Chỉ cần match tournamentId — không phụ thuộc status
  const partStatus = participation?.status ?? null

  const handleRegister = async () => {
    setRegistering(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      await onRegister(tournament.tournamentId)
      setSuccessMsg('Đăng ký thành công, đang chờ Admin duyệt.')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
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
            className="text-blue-200 hover:text-white transition-colors text-2xl leading-none font-light ml-4"
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
              { icon: '🐴', label: 'Giống ngựa cho phép', value: tournament.allowedBreed },
              { icon: '🏟️', label: 'Loại đường đua',      value: tournament.trackType },
              { icon: '📏', label: 'Khoảng cách đua',     value: `${tournament.raceDistance} m` },
              { icon: '🏆', label: 'Hạng mục',            value: tournament.raceCategory },
              { icon: '👤', label: 'Kinh nghiệm tối thiểu', value: `${tournament.minJockeyExperienceYears} năm` },
              { icon: '🐎', label: 'Số ngựa tối đa',      value: String(tournament.maxHorses) },
              { icon: '💰', label: 'Tổng giải thưởng',    value: formatCurrency(tournament.purseAmount) },
              { icon: '🎫', label: 'Phí tham dự',         value: formatCurrency(tournament.entryFeeAmount) },
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

          {/* ── Khu vực đăng ký (chỉ khi Open Registration) ── */}
          {isOpen && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              {/* Rejection / ManualReview reason */}
              {partStatus && isRejectedStatus(partStatus) && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-700 text-xs font-medium uppercase tracking-wide mb-1">Lý do từ chối</p>
                  <p className="text-red-800 text-sm">
                    {
                      // ParticipationResponse có screeningReason nếu BE trả về
                      (participation as ParticipationResponse & { screeningReason?: string }).screeningReason
                      || 'Đăng ký của bạn đã bị từ chối.'
                    }
                  </p>
                </div>
              )}

              {/* ManualReview info */}
              {partStatus === 'ManualReview' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                  <p className="text-yellow-700 text-xs font-medium uppercase tracking-wide mb-1">Ghi chú</p>
                  <p className="text-yellow-800 text-sm">
                    {
                      (participation as ParticipationResponse & { screeningReason?: string }).screeningReason
                      || 'Hồ sơ của bạn đang được Admin xem xét thủ công.'
                    }
                  </p>
                </div>
              )}

              {/* Success message */}
              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-emerald-800 text-sm font-medium">✅ {successMsg}</p>
                </div>
              )}

              {/* Error message */}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-800 text-sm font-medium">❌ {errorMsg}</p>
                </div>
              )}

              {/* Button */}
              {partStatus ? (
                // Đã đăng ký — hiện trạng thái, disabled
                <button
                  disabled
                  className={`w-full flex items-center justify-center gap-2 border font-semibold py-2.5 rounded-xl text-sm ${getRegStatus(partStatus).cls}`}
                >
                  {getRegStatus(partStatus).label}
                </button>
              ) : !successMsg ? (
                // Chưa đăng ký — hiện nút đăng ký
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-300 disabled:to-indigo-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
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
                    '🏁 Đăng ký tham gia'
                  )}
                </button>
              ) : (
                // Đã đăng ký xong trong phiên này — hiện Pending
                <button
                  disabled
                  className={`w-full flex items-center justify-center gap-2 border font-semibold py-2.5 rounded-xl text-sm ${getRegStatus('Pending').cls}`}
                >
                  {getRegStatus('Pending').label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tournament Card ───────────────────────────────────────────────────────────
interface CardProps {
  tournament: TournamentResponse
  participation: ParticipationResponse | null
  onOpenDetail: (t: TournamentResponse) => void
}

function TournamentCard({ tournament: t, participation, onOpenDetail }: CardProps) {
  // Chỉ cần match tournamentId — không phụ thuộc status
  const partStatus = participation?.status ?? null

  return (
    <div className="group bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col">
      {/* Header */}
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
          <p className="text-xs text-gray-400 mb-0.5">📏 Khoảng cách</p>
          <p className="text-xs font-semibold text-gray-700">{t.raceDistance} m</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100">
          <p className="text-xs text-blue-400 mb-0.5">💰 Giải thưởng</p>
          <p className="text-xs font-bold text-blue-700 truncate">{formatCurrency(t.purseAmount)}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-2.5 border border-purple-100">
          <p className="text-xs text-purple-400 mb-0.5">👤 KN tối thiểu</p>
          <p className="text-xs font-bold text-purple-700">{t.minJockeyExperienceYears} năm</p>
        </div>
      </div>

      {/* Registration badge (nếu đã đăng ký) */}
      {partStatus && (
        <div className={`mb-3 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border ${getRegStatus(partStatus).cls}`}>
          {getRegStatus(partStatus).label}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => onOpenDetail(t)}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
      >
        Xem chi tiết →
      </button>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
const JockeyTournamentList: React.FC = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([])
  const [participations, setParticipations] = useState<ParticipationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<TournamentResponse | null>(null)
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // ── Fetch participations ──
  const fetchParticipations = useCallback(async () => {
    try {
      const list = await getMyTournamentParticipations()
      setParticipations(list)
    } catch {
      // không chặn UX nếu lỗi
    }
  }, [])

  // ── Initial load ──
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

  // ── Handle register ──
  const handleRegister = useCallback(async (tournamentId: number) => {
    await registerForTournament(tournamentId)
    await fetchParticipations()
    setToastMsg('Đăng ký thành công, đang chờ Admin duyệt.')
    setTimeout(() => setToastMsg(null), 5000)
  }, [fetchParticipations])

  // ── Filter ──
  const openTournaments = tournaments.filter(t => t.status === 'Open Registration')
  const displayed = (showAll ? tournaments : openTournaments).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const getParticipation = (id: number) =>
    participations.find(p => p.tournamentId === id) ?? null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            🏆 Đăng ký Giải đấu
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Xem và đăng ký các giải đấu đang mở đăng ký
          </p>
        </div>
        {!loading && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
            <span className="text-emerald-600 font-bold text-lg">{openTournaments.length}</span>
            <span className="text-emerald-600 text-sm">giải mở đăng ký</span>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
        <button
          onClick={() => setShowAll(v => !v)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
            showAll
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
          }`}
        >
          {showAll ? 'Chỉ xem mở đăng ký' : 'Xem tất cả giải'}
        </button>
      </div>

      {/* ── My registrations banner ── */}
      {participations.length > 0 && (
        <div className="mb-5 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-blue-700 text-sm font-semibold mb-2">📋 Đăng ký của bạn</p>
          <div className="flex flex-wrap gap-2">
            {participations.map(p => {
              const st = p.status as ParticipationStatus
              const cfg = REG_STATUS[st] ?? { label: p.status, cls: 'bg-gray-50 border-gray-300 text-gray-700' }
              return (
                <span
                  key={p.participationId}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${cfg.cls}`}
                >
                  {p.tournamentName || `Giải #${p.tournamentId}`}
                  <span className="opacity-70">— {cfg.label}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

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
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Không có giải đấu nào</h2>
          <p className="text-gray-500 text-sm">
            {showAll ? 'Thử thay đổi từ khóa tìm kiếm.' : 'Hiện không có giải đấu nào đang mở đăng ký.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayed.map(t => (
            <TournamentCard
              key={t.tournamentId}
              tournament={t}
              participation={getParticipation(t.tournamentId)}
              onOpenDetail={setSelected}
            />
          ))}
        </div>
      )}

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-2">
          ✅ {toastMsg}
        </div>
      )}

      {/* ── Modal ── */}
      {selected && (
        <TournamentDetailModal
          tournament={selected}
          participation={getParticipation(selected.tournamentId)}
          onClose={() => setSelected(null)}
          onRegister={handleRegister}
        />
      )}
    </div>
  )
}

export default JockeyTournamentList
