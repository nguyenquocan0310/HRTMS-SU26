import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  formatDeterministicRaceTime,
  isDeterministicRaceEntryEligible,
  simulateDeterministicRace,
  type DeterministicFinishResult,
  type DeterministicRaceSnapshot,
} from '../../features/live-race/deterministicRaceSimulation'
import { ApiRequestError } from '../../services/apiClient'
import {
  confirmStartingList,
  createRaceViolation,
  deleteRaceViolation,
  finishRace,
  getMyRefereeRaceAssignments,
  getRaceLiveStatus,
  getRaceViolations,
  getRefereeRaceEntries,
  getViolationCodes,
  startRace,
  updateRaceViolation,
  type ConfirmStartingListResult,
  type CreateViolationPayload,
  type FinishRacePayload,
  type RaceLiveStatus,
  type RaceViolation,
  type RefereeRaceAssignment,
  type RefereeRaceEntry,
  type StartingListEntry,
  type ViolationCodeOption,
} from '../../services/refereeService'

const PENALTIES = ['Disqualified', 'PlaceBehind', 'Warning', 'Scratch'] as const
const inactiveEntry = (entry: { status: string; isWithdrawn?: boolean }) => entry.isWithdrawn || ['cancelled', 'withdrawn', 'disqualified'].includes(entry.status.toLowerCase())
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa có lịch'
const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiRequestError) {
    return error.code ? `[${error.code}] ${error.message}` : error.message
  }
  return error instanceof Error && error.message ? error.message : fallback
}
const EMPTY_SIMULATION: DeterministicRaceSnapshot = {
  elapsedMs: 0,
  eligibleEntryCount: 0,
  results: [],
  complete: false,
}

function StatusBadge({ status }: { status?: string | null }) {
  const value = status || 'Chưa có dữ liệu'
  const normalized = value.toLowerCase()
  const style = normalized === 'live' ? 'border-red-200 bg-red-50 text-red-700' : normalized === 'unofficial' ? 'border-amber-200 bg-amber-50 text-amber-700' : normalized === 'official' || normalized === 'fit' || normalized === 'matched' || normalized === 'confirmed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : normalized === 'cancelled' || normalized === 'withdrawn' || normalized === 'disqualified' || normalized === 'unfit' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${style}`}>{value}</span>
}

function ResultTable({ title, items }: { title: string; items: StartingListEntry[] }) {
  if (items.length === 0) return null
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="font-bold text-slate-900">{title}</h3></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">GATE</th><th className="px-5 py-3">Ngựa</th><th className="px-5 py-3">Kỵ sĩ</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3">Lý do</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item.raceEntryId}><td className="px-5 py-4 font-bold">{item.postPosition ?? '—'}</td><td className="px-5 py-4 font-bold text-slate-900">{item.horseName}</td><td className="px-5 py-4">{item.jockeyName}</td><td className="px-5 py-4">{item.ownerName || '—'}</td><td className="px-5 py-4"><StatusBadge status={item.status} /></td><td className="px-5 py-4 text-slate-500">{item.rejectionReason || '—'}</td></tr>)}</tbody></table></div></section>
}

function UnofficialResultsTable({ liveStatus }: { liveStatus: RaceLiveStatus }) {
  const isOfficial = liveStatus.status === 'Official'
  const items = [...liveStatus.entries].sort((a, b) => {
    if (a.finishPosition == null) return b.finishPosition == null ? 0 : 1
    if (b.finishPosition == null) return -1
    return a.finishPosition - b.finishPosition
  })

  return (
    <section className={`overflow-hidden rounded-xl border bg-white shadow-sm ${isOfficial ? 'border-emerald-200' : 'border-amber-200'}`}>
      <div className={`border-b px-5 py-4 ${isOfficial ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-amber-50'}`}>
        <h2 className={`font-bold ${isOfficial ? 'text-emerald-950' : 'text-amber-950'}`}>{isOfficial ? 'Kết quả chính thức' : 'Kết quả sơ bộ'}</h2>
        {isOfficial && <p className="mt-1 text-xs text-emerald-800">Kết quả đã được Admin công bố Official.</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-5 py-3">Hạng</th><th className="px-5 py-3">GATE</th><th className="px-5 py-3">Ngựa / Kỵ sĩ</th><th className="px-5 py-3">Thời gian</th><th className="px-5 py-3">Trạng thái</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((entry) => (
              <tr key={entry.raceEntryId}>
                <td className="px-5 py-4 text-lg font-black text-slate-950">{entry.finishPosition ?? '—'}</td>
                <td className="px-5 py-4 font-bold text-slate-600">{entry.postPosition ?? '—'}</td>
                <td className="px-5 py-4"><p className="font-bold text-slate-900">{entry.horseName}</p><p className="text-xs text-slate-500">{entry.jockeyName}</p></td>
                <td className="px-5 py-4">{entry.finishTime != null ? `${entry.finishTime} giây` : '—'}</td>
                <td className="px-5 py-4"><StatusBadge status={entry.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AutomaticResultsTable({
  liveStatus,
  results,
  compact = false,
}: {
  liveStatus: RaceLiveStatus
  results: DeterministicFinishResult[]
  compact?: boolean
}) {
  const entryById = new Map(liveStatus.entries.map((entry) => [entry.raceEntryId, entry]))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Hạng</th>
            <th className="px-4 py-3">GATE</th>
            <th className="px-4 py-3">Ngựa</th>
            <th className="px-4 py-3">Kỵ sĩ</th>
            <th className="px-4 py-3">Thời gian</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {results.map((result) => {
            const entry = entryById.get(result.raceEntryId)
            return (
              <tr key={result.raceEntryId}>
                <td className="px-4 py-3 text-lg font-black text-slate-950">{result.finishPosition}</td>
                <td className="px-4 py-3 font-bold text-slate-600">{entry?.postPosition ?? '—'}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{entry?.horseName ?? `Entry ${result.raceEntryId}`}</td>
                <td className="px-4 py-3 text-slate-600">{entry?.jockeyName ?? '—'}</td>
                <td className="px-4 py-3 font-mono font-bold">{formatDeterministicRaceTime(result.finishElapsedMs)}</td>
              </tr>
            )
          })}
          {results.length === 0 && (
            <tr>
              <td colSpan={5} className={`px-5 text-center text-sm text-slate-500 ${compact ? 'py-6' : 'py-12'}`}>
                Chưa có ngựa cán đích.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function RefereeRaceConsole() {
  const location = useLocation()
  const navigate = useNavigate()
  const rawRaceId = new URLSearchParams(location.search).get('raceId')
  const raceId = rawRaceId && Number.isInteger(Number(rawRaceId)) && Number(rawRaceId) > 0 ? Number(rawRaceId) : null
  const [assignments, setAssignments] = useState<RefereeRaceAssignment[]>([])
  const [assignment, setAssignment] = useState<RefereeRaceAssignment | null>(null)
  const [entries, setEntries] = useState<RefereeRaceEntry[]>([])
  const [liveStatus, setLiveStatus] = useState<RaceLiveStatus | null>(null)
  const [violations, setViolations] = useState<RaceViolation[]>([])
  const [violationCodes, setViolationCodes] = useState<ViolationCodeOption[]>([])
  const [startingListResult, setStartingListResult] = useState<ConfirmStartingListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [showViolationForm, setShowViolationForm] = useState(false)
  const [editingViolationId, setEditingViolationId] = useState<number | null>(null)
  const [showFinishConfirmation, setShowFinishConfirmation] = useState(false)
  const [violationForm, setViolationForm] = useState<CreateViolationPayload>({ raceEntryId: 0, violationCode: '', penalty: '', description: '' })
  const [finishNotes, setFinishNotes] = useState('')
  const [finishError, setFinishError] = useState('')
  const [simulationSnapshot, setSimulationSnapshot] = useState<DeterministicRaceSnapshot>(EMPTY_SIMULATION)
  const finishSubmissionRef = useRef(false)

  const loadConsole = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true)
    setError('')
    try {
      const assigned = await getMyRefereeRaceAssignments()
      setAssignments(assigned)
      if (!raceId) { setAssignment(null); setEntries([]); setLiveStatus(null); setViolations([]); return }
      const matched = assigned.find((item) => item.raceId === raceId) ?? null
      setAssignment(matched)
      if (!matched) {
        setEntries([]); setLiveStatus(null); setViolations([])
        setError('Cuộc đua này không thuộc phạm vi được phân công của bạn.')
        return
      }
      const [entryList, statusResult, violationList, codeList] = await Promise.all([
        getRefereeRaceEntries(raceId), getRaceLiveStatus(raceId), getRaceViolations(raceId), getViolationCodes(),
      ])
      setEntries(entryList); setLiveStatus(statusResult); setViolations(violationList); setViolationCodes(codeList)
    } catch (loadError) { setError(errorMessage(loadError, 'Không tải được dữ liệu bàn điều hành.')) }
    finally { setLoading(false); setRefreshing(false) }
  }, [raceId])

  useEffect(() => { const id = window.setTimeout(() => void loadConsole(), 0); return () => window.clearTimeout(id) }, [loadConsole])
  useEffect(() => { if (!raceId || liveStatus?.status !== 'Live' || !assignment) return; const id = window.setInterval(() => { void Promise.all([getRaceLiveStatus(raceId), getRaceViolations(raceId)]).then(([status, items]) => { setLiveStatus(status); setViolations(items) }).catch(() => undefined) }, 5000); return () => window.clearInterval(id) }, [assignment, liveStatus?.status, raceId])
  useEffect(() => {
    if (!raceId || liveStatus?.status !== 'Live') return
    const updateSimulation = () => {
      const snapshot = simulateDeterministicRace({
        raceId,
        entries: liveStatus.entries,
        actualStartTime: liveStatus.actualStartTime,
        now: Date.now(),
      })
      setSimulationSnapshot(snapshot)
      return snapshot
    }
    if (updateSimulation().complete) return
    const id = window.setInterval(() => {
      if (updateSimulation().complete) window.clearInterval(id)
    }, 100)
    return () => window.clearInterval(id)
  }, [liveStatus, raceId])

  const raceStatus = liveStatus?.status ?? assignment?.raceStatus ?? ''
  const eligibleLiveEntries = useMemo(() => liveStatus?.entries.filter(isDeterministicRaceEntryEligible) ?? [], [liveStatus])
  const notify = (value: string) => { setMessage(value); window.setTimeout(() => setMessage(''), 4000) }

  const handleConfirmStartingList = async () => {
    if (!raceId || !assignment || raceStatus !== 'Upcoming') return
    setSavingKey('starting-list')
    try { const result = await confirmStartingList(raceId); setStartingListResult(result); notify(result.message || 'Đã xác nhận danh sách xuất phát.'); await loadConsole(true) }
    catch (actionError) { notify(errorMessage(actionError, 'Không thể xác nhận danh sách xuất phát.')) }
    finally { setSavingKey(null) }
  }

  const handleStartRace = async () => {
    if (!raceId || !assignment || raceStatus !== 'Pre-Race' || !window.confirm('Xác nhận bắt đầu cuộc đua này?')) return
    setSavingKey('start-race')
    try { await startRace(raceId); await loadConsole(true); notify('Cuộc đua đã chuyển sang Live.') }
    catch (actionError) { notify(errorMessage(actionError, 'Không thể bắt đầu cuộc đua.')) }
    finally { setSavingKey(null) }
  }

  const resetViolationForm = () => { setViolationForm({ raceEntryId: 0, violationCode: '', penalty: '', description: '' }); setEditingViolationId(null); setShowViolationForm(false) }
  const editViolation = (item: RaceViolation) => {
    if (!item.violationId || !item.raceEntryId) return
    setViolationForm({ raceEntryId: item.raceEntryId, violationCode: item.violationCode, penalty: item.penalty, placeBehindEntryId: item.placeBehindEntryId ?? undefined, description: item.description ?? '' })
    setEditingViolationId(item.violationId); setShowViolationForm(true)
  }
  const handleSaveViolation = async () => {
    if (!raceId || raceStatus !== 'Live') return
    if (!violationForm.raceEntryId || !violationForm.violationCode || !PENALTIES.includes(violationForm.penalty as typeof PENALTIES[number]) || !violationForm.description.trim()) { notify('Vui lòng nhập đầy đủ entry, mã, hình phạt và mô tả vi phạm.'); return }
    if (violationForm.penalty === 'PlaceBehind' && !violationForm.placeBehindEntryId) { notify('Vui lòng chọn entry xếp sau cho hình phạt PlaceBehind.'); return }
    const payload = { violationCode: violationForm.violationCode, penalty: violationForm.penalty, description: violationForm.description.trim(), ...(violationForm.penalty === 'PlaceBehind' && violationForm.placeBehindEntryId ? { placeBehindEntryId: violationForm.placeBehindEntryId } : {}) }
    setSavingKey('violation')
    try {
      if (editingViolationId) await updateRaceViolation(raceId, editingViolationId, payload)
      else await createRaceViolation(raceId, { raceEntryId: violationForm.raceEntryId, ...payload })
      setViolations(await getRaceViolations(raceId)); notify(editingViolationId ? 'Đã cập nhật vi phạm.' : 'Đã ghi nhận vi phạm.'); resetViolationForm()
    } catch (actionError) { notify(errorMessage(actionError, 'Không thể lưu vi phạm.')) }
    finally { setSavingKey(null) }
  }
  const handleDeleteViolation = async (item: RaceViolation) => {
    if (!raceId || !item.violationId || raceStatus !== 'Live' || !window.confirm(`Xóa vi phạm ${item.violationCode}?`)) return
    setSavingKey(`delete-${item.violationId}`)
    try { await deleteRaceViolation(raceId, item.violationId); setViolations(await getRaceViolations(raceId)); notify('Đã xóa vi phạm.') }
    catch (actionError) { notify(errorMessage(actionError, 'Không thể xóa vi phạm.')) }
    finally { setSavingKey(null) }
  }

  const handleFinishRace = async () => {
    if (
      !raceId
      || raceStatus !== 'Live'
      || !simulationSnapshot.complete
      || finishSubmissionRef.current
    ) return
    const payload: FinishRacePayload = {
      notes: finishNotes.trim(),
      results: simulationSnapshot.results.map((result) => ({
        raceEntryId: result.raceEntryId,
        finishPosition: result.finishPosition,
        finishTime: result.finishTime,
      })),
    }
    finishSubmissionRef.current = true
    setFinishError('')
    setSavingKey('finish-race')
    try {
      await finishRace(raceId, payload)
      setShowFinishConfirmation(false)
      await loadConsole(true)
      notify('Đã ghi nhận kết quả sơ bộ. Đang chờ khám sau trận.')
    } catch (actionError) {
      const detail = errorMessage(actionError, 'Không thể kết thúc cuộc đua.')
      setFinishError(detail)
      notify(detail)
    } finally {
      finishSubmissionRef.current = false
      setSavingKey(null)
    }
  }

  if (loading) return <div className="space-y-5" aria-busy="true"><div className="h-24 animate-pulse rounded-xl bg-white" /><div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" /></div>

  return <div className="space-y-6">
    {liveStatus && ['Unofficial', 'Official'].includes(liveStatus.status) && <UnofficialResultsTable liveStatus={liveStatus} />}
    {message && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl">{message}</div>}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Điều hành cuộc đua</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Bàn điều hành Referee</h1><p className="mt-2 text-sm text-slate-500">Chỉ các cuộc đua được Admin phân công mới có thể mở và thao tác.</p></div>{raceId && <button type="button" onClick={() => navigate('/referee/race-console')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Đổi cuộc đua</button>}</div>

    {!raceId ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Cuộc đua được phân công</h2><p className="mt-1 text-xs text-slate-500">Chọn một race để mở bàn điều hành.</p></div>{assignments.length === 0 ? <div className="px-6 py-14 text-center"><p className="font-bold text-slate-700">Chưa có cuộc đua được phân công.</p><p className="mt-1 text-sm text-slate-500">Admin sẽ phân công sau khi bạn được duyệt vào roster.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Giải đấu / vòng</th><th className="px-5 py-3">Race</th><th className="px-5 py-3">Thời gian</th><th className="px-5 py-3">Vai trò</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{assignments.map((item) => <tr key={`${item.raceId}-${item.assignedAt}`}><td className="px-5 py-4"><p className="font-bold text-slate-900">{item.tournamentName ?? '—'}</p><p className="mt-1 text-xs text-slate-500">{item.roundName ?? '—'}</p></td><td className="px-5 py-4 font-bold">#{item.raceNumber ?? item.raceId}</td><td className="whitespace-nowrap px-5 py-4">{formatDateTime(item.scheduledTime)}</td><td className="px-5 py-4">{item.assignmentRole ?? item.role ?? 'Referee'}</td><td className="px-5 py-4"><StatusBadge status={item.raceStatus} /></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => navigate(`/referee/race-console?raceId=${item.raceId}`)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold">Mở bàn điều hành</button></td></tr>)}</tbody></table></div>}</section> : error || !assignment ? <section className="rounded-xl border border-red-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-slate-900">Không thể mở cuộc đua</h2><p role="alert" className="mt-2 text-sm text-red-700">{error || 'Không tìm thấy phân công phù hợp.'}</p><button type="button" onClick={() => navigate('/referee/race-console')} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold">Về danh sách phân công</button></section> : <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-slate-950">{assignment.tournamentName ?? 'Giải đấu'} · Race #{assignment.raceNumber ?? assignment.raceId}</h2><StatusBadge status={raceStatus} /></div><p className="mt-2 text-sm text-slate-500">{assignment.roundName ?? '—'} · {formatDateTime(assignment.scheduledTime)} · {assignment.assignmentRole ?? assignment.role ?? 'Referee'}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void loadConsole(true)} disabled={refreshing} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">{refreshing ? 'Đang tải...' : 'Làm mới'}</button>{raceStatus === 'Upcoming' && <button type="button" onClick={() => void handleConfirmStartingList()} disabled={savingKey === 'starting-list' || entries.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold disabled:opacity-50">{savingKey === 'starting-list' ? 'Đang xác nhận...' : 'Xác nhận starting list'}</button>}{raceStatus === 'Pre-Race' && <button type="button" onClick={() => void handleStartRace()} disabled={savingKey === 'start-race'} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold disabled:opacity-50">{savingKey === 'start-race' ? 'Đang bắt đầu...' : 'Bắt đầu cuộc đua'}</button>}{raceStatus === 'Live' && <><button type="button" onClick={() => { resetViolationForm(); setShowViolationForm(true) }} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900">Ghi nhận vi phạm</button><button type="button" onClick={() => { setFinishError(''); setShowFinishConfirmation(true) }} disabled={!simulationSnapshot.complete || savingKey === 'finish-race'} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Kết thúc cuộc đua</button></>}</div></div>{raceStatus === 'Live' && !simulationSnapshot.complete && <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">Đang chờ tất cả ngựa cán đích.</p>}{raceStatus === 'Unofficial' && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">Đã ghi nhận kết quả sơ bộ. Đang chờ khám sau trận.</p>}{raceStatus === 'Official' && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Kết quả đã được Admin công bố Official. Referee chỉ có quyền xem.</p>}</section>

      {showViolationForm && raceStatus === 'Live' && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">{editingViolationId ? 'Cập nhật vi phạm' : 'Ghi nhận vi phạm'}</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Race entry<select value={violationForm.raceEntryId} onChange={(event) => setViolationForm((prev) => ({ ...prev, raceEntryId: Number(event.target.value) }))} disabled={editingViolationId !== null} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value={0}>Chọn entry hợp lệ</option>{eligibleLiveEntries.map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>GATE {entry.postPosition ?? '—'} · {entry.horseName} / {entry.jockeyName}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Mã vi phạm<select value={violationForm.violationCode} onChange={(event) => setViolationForm((prev) => ({ ...prev, violationCode: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn mã backend hỗ trợ</option>{violationCodes.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Hình phạt<select value={violationForm.penalty} onChange={(event) => setViolationForm((prev) => ({ ...prev, penalty: event.target.value, placeBehindEntryId: undefined }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn hình phạt</option>{PENALTIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{violationForm.penalty === 'PlaceBehind' && <label className="text-sm font-bold text-slate-700">Xếp sau entry<select value={violationForm.placeBehindEntryId ?? ''} onChange={(event) => setViolationForm((prev) => ({ ...prev, placeBehindEntryId: event.target.value ? Number(event.target.value) : undefined }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn entry</option>{eligibleLiveEntries.filter((entry) => entry.raceEntryId !== violationForm.raceEntryId).map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>{entry.horseName} / {entry.jockeyName}</option>)}</select></label>}<label className="text-sm font-bold text-slate-700 md:col-span-2">Mô tả<textarea rows={3} value={violationForm.description} onChange={(event) => setViolationForm((prev) => ({ ...prev, description: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={resetViolationForm} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Hủy</button><button type="button" onClick={() => void handleSaveViolation()} disabled={savingKey === 'violation'} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingKey === 'violation' ? 'Đang lưu...' : 'Lưu vi phạm'}</button></div></section>}

      {raceStatus === 'Live' && liveStatus && <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-blue-100 bg-blue-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-blue-950">Kết quả cán đích tự động</h2><p className="mt-1 text-xs text-blue-800">Thứ hạng và thời gian được tạo từ cùng mô phỏng deterministic với Spectator.</p></div><p className="font-black text-blue-950" aria-live="polite">{simulationSnapshot.results.length}/{simulationSnapshot.eligibleEntryCount} ngựa đã cán đích</p></div><AutomaticResultsTable liveStatus={liveStatus} results={simulationSnapshot.results} /></section>}

      {showFinishConfirmation && raceStatus === 'Live' && liveStatus && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="finish-race-title"><section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="border-b border-slate-200 px-6 py-5"><h2 id="finish-race-title" className="text-xl font-black text-slate-950">Xác nhận kết thúc cuộc đua</h2><p className="mt-1 text-sm text-slate-500">Kiểm tra kết quả sẽ gửi lên backend. Referee không thể chỉnh sửa hạng hoặc thời gian.</p></div><AutomaticResultsTable liveStatus={liveStatus} results={simulationSnapshot.results} compact /><div className="border-t border-slate-200 p-6"><label className="text-sm font-bold text-slate-700">Ghi chú, không bắt buộc<textarea rows={3} value={finishNotes} onChange={(event) => setFinishNotes(event.target.value)} disabled={savingKey === 'finish-race'} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100" /></label>{finishError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{finishError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setShowFinishConfirmation(false); setFinishError('') }} disabled={savingKey === 'finish-race'} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">Hủy</button><button type="button" onClick={() => void handleFinishRace()} disabled={!simulationSnapshot.complete || savingKey === 'finish-race'} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingKey === 'finish-race' ? 'Đang gửi...' : 'Xác nhận kết quả Unofficial'}</button></div></div></section></div>}

      <div className="grid gap-6 xl:grid-cols-2"><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Race entries</h2><p className="mt-1 text-xs text-slate-500">Dữ liệu xuất phát và điều kiện y tế do backend cung cấp.</p></div>{entries.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">Chưa có race entry.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">GATE</th><th className="px-4 py-3">Ngựa / Kỵ sĩ</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Kiểm tra</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map((entry) => <tr key={entry.raceEntryId} className={inactiveEntry({ status: entry.raceEntryStatus ?? entry.status, isWithdrawn: entry.isWithdrawn }) ? 'bg-slate-50 text-slate-500' : ''}><td className="px-4 py-4 font-bold">{entry.postPosition ?? '—'}</td><td className="px-4 py-4"><p className="font-bold text-slate-900">{entry.horseName}</p><p className="text-xs text-slate-500">{entry.jockeyName}</p>{entry.ownerName && <p className="mt-1 text-xs text-slate-400">Owner: {entry.ownerName}</p>}</td><td className="px-4 py-4"><StatusBadge status={entry.isWithdrawn ? 'Withdrawn' : entry.raceEntryStatus ?? entry.status} />{entry.rejectionReason && <p className="mt-2 max-w-48 text-xs font-semibold text-red-700">{entry.rejectionReason}</p>}</td><td className="px-4 py-4 text-xs leading-5 text-slate-600"><p>Danh tính: {entry.horseIdentityCheckStatus ?? 'Chưa kiểm tra'}</p><p>Lâm sàng: {entry.clinicalStatus ?? 'Chưa kiểm tra'}</p><p>Cân trước đua: {entry.preRaceJockeyWeight != null ? `${entry.preRaceJockeyWeight} kg` : 'Chưa cân'}</p></td></tr>)}</tbody></table></div>}</section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Vi phạm</h2><p className="mt-1 text-xs text-slate-500">Chỉ có thể sửa hoặc xóa khi race đang Live.</p></div>{violations.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">Chưa có vi phạm được ghi nhận.</p> : <div className="divide-y divide-slate-100">{violations.map((item, index) => <article key={item.violationId ?? index} className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{item.violationCode}</p><StatusBadge status={item.penalty} /></div><p className="mt-1 text-sm text-slate-600">{item.horseName || item.jockeyName || `Entry ${item.raceEntryId}`}</p><p className="mt-2 text-sm text-slate-500">{item.description || '—'}</p><p className="mt-2 text-xs text-slate-400">{formatDateTime(item.loggedAt ?? item.recordedAt)}</p></div>{raceStatus === 'Live' && item.violationId && <div className="flex gap-2"><button type="button" onClick={() => editViolation(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Sửa</button><button type="button" onClick={() => void handleDeleteViolation(item)} disabled={savingKey === `delete-${item.violationId}`} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{savingKey === `delete-${item.violationId}` ? 'Đang xóa...' : 'Xóa'}</button></div>}</div></article>)}</div>}</section></div>
      {startingListResult && <div className="space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900"><p className="font-bold">{startingListResult.message || 'Đã xác nhận danh sách xuất phát.'}</p><p className="mt-1">Được xác nhận: {startingListResult.confirmedEntriesCount} · Bị loại: {startingListResult.rejectedEntriesCount}</p></div><ResultTable title="Entries được xác nhận" items={startingListResult.confirmedEntries ?? []} /><ResultTable title="Entries bị loại" items={startingListResult.rejectedEntries ?? []} /></div>}
    </>}
  </div>
}
