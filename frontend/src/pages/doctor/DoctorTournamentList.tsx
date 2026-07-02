import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTournaments,
  registerForTournament,
  getMyTournamentParticipations,
  type TournamentResponse,
  type ParticipationResponse,
} from '../../services/tournamentService'

// ─── Status config cho giải đấu ──────────────────────────────────────────────
const TOURNAMENT_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Upcoming:            { label: 'Sắp diễn ra',  bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  Active:              { label: 'Đang diễn ra', bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500'   },
  Completed:           { label: 'Đã kết thúc',  bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400'    },
  Cancelled:           { label: 'Đã hủy',       bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500'     },
  Draft:               { label: 'Nháp',          bg: 'bg-yellow-50',  text: 'text-yellow-700',  dot: 'bg-yellow-500'  },
  'Open Registration': { label: 'Mở đăng ký',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
}

// ─── Participation status config (Doctor sau khi đăng ký) ────────────────────
const REG_STATUS: Record<string, { label: string; cls: string }> = {
  Pending:      { label: '⏳ Đang chờ duyệt', cls: 'bg-yellow-50 border-yellow-300 text-yellow-700 cursor-not-allowed' },
  ManualReview: { label: '⏳ Đang chờ duyệt', cls: 'bg-yellow-50 border-yellow-300 text-yellow-700 cursor-not-allowed' },
  Approved:     { label: '✅ Đã được duyệt',  cls: 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-not-allowed' },
  AutoEligible: { label: '✅ Đã được duyệt',  cls: 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-not-allowed' },
  Rejected:     { label: '❌ Bị từ chối',     cls: 'bg-red-50 border-red-300 text-red-700 cursor-not-allowed' },
  AutoRejected: { label: '❌ Bị từ chối',     cls: 'bg-red-50 border-red-300 text-red-700 cursor-not-allowed' },
}

/** Trả về config cho bất kỳ participation status nào — fallback an toàn, không bao giờ undefined. */
function getRegStatusCfg(status: string): { label: string; cls: string } {
  return (
    REG_STATUS[status] ?? {
      label: `ℹ️ ${status}`,
      cls: 'bg-gray-50 border-gray-300 text-gray-700 cursor-not-allowed',
    }
  )
}

function isRejectedStatus(status: string): boolean {
  return status === 'Rejected' || status === 'AutoRejected'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function TournamentStatusBadge({ status }: { status: string }) {
  const cfg = TOURNAMENT_STATUS_CONFIG[status] ?? {
    label: status,
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────
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

  const partStatus = participation?.status ?? null
  const isRegistered = partStatus !== null

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
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-0.5">Chi tiết giải đấu</p>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{tournament.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none font-light ml-4 mt-0.5 p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status + dates */}
          <div className="flex flex-wrap gap-3 items-center">
            <TournamentStatusBadge status={tournament.status} />
            <span className="text-xs text-gray-500">
              {formatDate(tournament.startDate)} — {formatDate(tournament.endDate)}
            </span>
          </div>

          {/* Description */}
          {tournament.description && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
              {tournament.description}
            </p>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Giống ngựa',           value: tournament.allowedBreed },
              { label: 'Loại đường đua',        value: tournament.trackType },
              { label: 'Khoảng cách đua',       value: `${tournament.raceDistance} m` },
              { label: 'Hạng mục',              value: tournament.raceCategory },
              { label: 'KN jockey tối thiểu',   value: `${tournament.minJockeyExperienceYears} năm` },
              { label: 'Số ngựa tối đa',        value: tournament.maxHorses },
              { label: 'Tổng giải thưởng',      value: formatCurrency(tournament.purseAmount) },
              { label: 'Phí tham dự',           value: formatCurrency(tournament.entryFeeAmount) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
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
                {tournament.rounds.map((round) => (
                  <div key={round.roundId} className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2.5 bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{round.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(round.scheduledDate)} · {round.races.length} cuộc đua
                      </p>
                    </div>
                    <TournamentStatusBadge status={round.status} />
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
                  .map((prize) => (
                    <div key={prize.position} className="bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-2 text-center min-w-[72px]">
                      <p className="text-yellow-700 font-bold text-sm">#{prize.position}</p>
                      <p className="text-yellow-600 text-xs font-medium">{prize.percentage}%</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ─── Khu vực đăng ký ─── */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {successMsg && (
              <div className="px-3 py-2.5 rounded-xl text-sm font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-2">
                <span>✓</span> {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="px-3 py-2.5 rounded-xl text-sm font-medium border bg-red-50 text-red-700 border-red-200">
                {errorMsg}
              </div>
            )}

            {isRegistered && partStatus ? (
              <div className="space-y-2">
                <button
                  disabled
                  className={`w-full flex items-center justify-center gap-2 border font-semibold py-2.5 rounded-xl text-sm ${getRegStatusCfg(partStatus).cls}`}
                >
                  {getRegStatusCfg(partStatus).label}
                </button>
                {participation?.screeningReason && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <span className="font-semibold text-gray-600">Lý do xét duyệt:</span>{' '}
                    {participation.screeningReason}
                  </p>
                )}
                {isRejectedStatus(partStatus) && participation?.rejectionReason && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                    <span className="font-semibold">Lý do từ chối:</span>{' '}
                    {participation.rejectionReason}
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:cursor-not-allowed shadow-sm"
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
        </div>
      </div>
    </div>
  )
}

// ─── Tournament Card ──────────────────────────────────────────────────────────
interface TournamentCardProps {
  tournament: TournamentResponse
  participation: ParticipationResponse | null
  onDetail: (t: TournamentResponse) => void
}

function TournamentCard({ tournament, participation, onDetail }: TournamentCardProps) {
  const partStatus = participation?.status ?? null
  const isRegistered = partStatus !== null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm leading-snug truncate">{tournament.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(tournament.startDate)} — {formatDate(tournament.endDate)}
          </p>
        </div>
        <TournamentStatusBadge status={tournament.status} />
      </div>

      {/* Quick info */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Giống ngựa</p>
          <p className="text-xs font-semibold text-gray-800 mt-0.5 truncate">{tournament.allowedBreed}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Cự ly</p>
          <p className="text-xs font-semibold text-gray-800 mt-0.5">{tournament.raceDistance} m</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Phí tham dự</p>
          <p className="text-xs font-semibold text-gray-800 mt-0.5">{formatCurrency(tournament.entryFeeAmount)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Giải thưởng</p>
          <p className="text-xs font-semibold text-emerald-700 mt-0.5">{formatCurrency(tournament.purseAmount)}</p>
        </div>
      </div>

      {/* Registration status tag */}
      {isRegistered && partStatus && (
        <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg border text-center ${getRegStatusCfg(partStatus).cls}`}>
          {getRegStatusCfg(partStatus).label}
        </div>
      )}

      {/* Action */}
      <button
        onClick={() => onDetail(tournament)}
        className="w-full border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs py-2 rounded-xl transition-colors"
      >
        Xem chi tiết {!isRegistered && '& Đăng ký'}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
const DoctorTournamentList: React.FC = () => {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<TournamentResponse | null>(null)
  const [search, setSearch] = useState('')
  // Map tournamentId → participation của Doctor hiện tại
  const [participationMap, setParticipationMap] = useState<Record<number, ParticipationResponse>>({})
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 5000)
  }

  const fetchParticipations = useCallback(async () => {
    try {
      const list = await getMyTournamentParticipations()
      const map: Record<number, ParticipationResponse> = {}
      for (const p of list) {
        map[p.tournamentId] = p
      }
      setParticipationMap(map)
    } catch {
      // Không chặn UX nếu API participations lỗi
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [all] = await Promise.all([getTournaments(), fetchParticipations()])
        // Chỉ giữ giải "Open Registration" để Doctor đăng ký
        setTournaments(all.filter((t) => t.status === 'Open Registration'))
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách giải đấu.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fetchParticipations])

  const handleRegister = useCallback(
    async (tournamentId: number) => {
      await registerForTournament(tournamentId)
      await fetchParticipations()
      showToast('Đăng ký thành công, đang chờ Admin duyệt.')
    },
    [fetchParticipations]
  )

  const selectedParticipation = selected ? (participationMap[selected.tournamentId] ?? null) : null
  const filtered = tournaments.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
  const registeredCount = filtered.filter((t) => participationMap[t.tournamentId] !== undefined).length

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-300 flex-shrink-0" />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đăng ký giải đấu</h1>
          <p className="text-sm text-gray-500 mt-1">
            Các giải đang mở đăng ký — đăng ký để được Admin duyệt và nhận phân công Paddock
          </p>
        </div>
        {!loading && (
          <span className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full self-start">
            {filtered.length} giải mở đăng ký
          </span>
        )}
      </div>

      {/* Tóm tắt trạng thái đăng ký */}
      {!loading && Object.keys(participationMap).length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg">📋</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Bạn đã đăng ký {registeredCount} / {filtered.length} giải đang mở
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Bấm "Xem chi tiết" để xem trạng thái duyệt của từng giải
            </p>
          </div>
          <button
            onClick={() => navigate('/doctor')}
            className="ml-auto text-xs font-semibold text-emerald-700 hover:underline flex-shrink-0"
          >
            Về Tổng quan ➔
          </button>
        </div>
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Tìm kiếm giải đấu theo tên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white transition-colors"
        />
      </div>

      {/* Content */}
      {error ? (
        <div className="py-20 text-center">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-sm font-semibold text-gray-700 mb-1">Không thể tải dữ liệu</p>
          <p className="text-xs text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
          >
            Thử lại
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {search ? 'Không tìm thấy giải phù hợp' : 'Hiện tại không có giải nào đang mở đăng ký'}
          </p>
          <p className="text-xs text-gray-400">
            {search
              ? 'Thử tìm với từ khóa khác.'
              : 'Vui lòng quay lại sau khi Admin mở đăng ký cho giải mới.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TournamentCard
              key={t.tournamentId}
              tournament={t}
              participation={participationMap[t.tournamentId] ?? null}
              onDetail={setSelected}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <TournamentDetailModal
          tournament={selected}
          participation={selectedParticipation}
          onClose={() => setSelected(null)}
          onRegister={handleRegister}
        />
      )}
    </div>
  )
}

export default DoctorTournamentList
