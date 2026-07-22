import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { closeProtestWindow, getProtestsByRace, ruleProtest } from '../../services/protestService'
import type { Penalty, Protest, ProtestDecision } from '../../types/protest.types'
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
const errorMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback

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
  const [showFinishForm, setShowFinishForm] = useState(false)
  const [violationForm, setViolationForm] = useState<CreateViolationPayload>({ raceEntryId: 0, violationCode: '', penalty: '', description: '' })
  const [finishNotes, setFinishNotes] = useState('')
  const [finishValues, setFinishValues] = useState<Record<number, { position: string; time: string }>>({})
  const [protests, setProtests] = useState<Protest[]>([])
  const [rulingProtestId, setRulingProtestId] = useState<number | null>(null)
  const [rulingRaceId, setRulingRaceId] = useState<number | null>(null)
  const [rulingDecision, setRulingDecision] = useState<ProtestDecision>('Approved')
  const [rulingPenalty, setRulingPenalty] = useState<Penalty | ''>('')
  const [rulingPlaceBehindId, setRulingPlaceBehindId] = useState<number | null>(null)
  const [rulingNotes, setRulingNotes] = useState('')
  const [closedProtestRaceId, setClosedProtestRaceId] = useState<number | null>(null)

  const loadConsole = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true)
    setError('')
    try {
      const assigned = await getMyRefereeRaceAssignments()
      setAssignments(assigned)
      if (!raceId) { setAssignment(null); setEntries([]); setLiveStatus(null); setViolations([]); setProtests([]); return }
      const matched = assigned.find((item) => item.raceId === raceId) ?? null
      setAssignment(matched)
      if (!matched) {
        setEntries([]); setLiveStatus(null); setViolations([]); setProtests([])
        setError('Cuộc đua này không thuộc phạm vi được phân công của bạn.')
        return
      }
      const [entryList, statusResult, violationList, codeList, protestList] = await Promise.all([
        getRefereeRaceEntries(raceId), getRaceLiveStatus(raceId), getRaceViolations(raceId), getViolationCodes(), getProtestsByRace(raceId),
      ])
      setEntries(entryList); setLiveStatus(statusResult); setViolations(violationList); setViolationCodes(codeList); setProtests(protestList)
    } catch (loadError) { setError(errorMessage(loadError, 'Không tải được dữ liệu bàn điều hành.')) }
    finally { setLoading(false); setRefreshing(false) }
  }, [raceId])

  useEffect(() => { const id = window.setTimeout(() => void loadConsole(), 0); return () => window.clearTimeout(id) }, [loadConsole])
  useEffect(() => { if (!raceId || liveStatus?.status !== 'Live' || !assignment) return; const id = window.setInterval(() => { void Promise.all([getRaceLiveStatus(raceId), getRaceViolations(raceId)]).then(([status, items]) => { setLiveStatus(status); setViolations(items) }).catch(() => undefined) }, 5000); return () => window.clearInterval(id) }, [assignment, liveStatus?.status, raceId])
  useEffect(() => { if (!raceId || liveStatus?.status !== 'Unofficial' || !assignment) return; const id = window.setInterval(() => { void getProtestsByRace(raceId).then(setProtests).catch(() => undefined) }, 5000); return () => window.clearInterval(id) }, [assignment, liveStatus?.status, raceId])

  const raceStatus = liveStatus?.status ?? assignment?.raceStatus ?? ''
  const eligibleLiveEntries = useMemo(() => liveStatus?.entries.filter((entry) => !inactiveEntry(entry)) ?? [], [liveStatus])
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
    if (!raceId || raceStatus !== 'Live') return
    const results = eligibleLiveEntries.map((entry) => ({ raceEntryId: entry.raceEntryId, finishPosition: Number(finishValues[entry.raceEntryId]?.position), ...(finishValues[entry.raceEntryId]?.time ? { finishTime: Number(finishValues[entry.raceEntryId].time) } : {}) }))
    if (results.length === 0 || results.some((item) => !Number.isInteger(item.finishPosition) || item.finishPosition <= 0 || (item.finishTime !== undefined && item.finishTime <= 0))) { notify('Mỗi entry hợp lệ phải có thứ hạng nguyên dương; thời gian nếu nhập phải lớn hơn 0.'); return }
    let expected = 1
    const groups = [...new Set(results.map((item) => item.finishPosition))].sort((a, b) => a - b)
    for (const position of groups) { if (position !== expected) { notify('Thứ hạng phải theo chuẩn thi đấu, ví dụ 1,2,3 hoặc đồng hạng 1,1,3.'); return } expected += results.filter((item) => item.finishPosition === position).length }
    if (!window.confirm('Chốt kết quả sơ bộ và chuyển cuộc đua sang Unofficial?')) return
    const payload: FinishRacePayload = { notes: finishNotes.trim(), results }
    setSavingKey('finish-race')
    try { await finishRace(raceId, payload); setShowFinishForm(false); await loadConsole(true); notify('Đã chốt kết quả sơ bộ. Kết quả đang chờ Admin công bố Official.') }
    catch (actionError) { notify(errorMessage(actionError, 'Không thể chốt kết quả sơ bộ.')) }
    finally { setSavingKey(null) }
  }

  const openRulingForm = (protest: Protest) => {
    setRulingProtestId(protest.protestId); setRulingRaceId(protest.raceId); setRulingDecision('Approved'); setRulingPenalty(''); setRulingPlaceBehindId(null); setRulingNotes('')
  }
  const closeRulingForm = () => { setRulingProtestId(null); setRulingRaceId(null); setRulingPenalty(''); setRulingPlaceBehindId(null); setRulingNotes('') }
  const handleRuleProtest = async () => {
    if (!raceId || !rulingProtestId || raceStatus !== 'Unofficial') return
    if (rulingNotes.trim().length < 10) { notify('Ghi chú phán quyết phải có ít nhất 10 ký tự.'); return }
    if (rulingDecision === 'Approved' && !rulingPenalty) { notify('Khi chấp thuận khiếu nại, vui lòng chọn hình phạt.'); return }
    if (rulingDecision === 'Approved' && rulingPenalty === 'PlaceBehind' && !rulingPlaceBehindId) { notify('Vui lòng chọn entry mục tiêu cho hình phạt PlaceBehind.'); return }
    setSavingKey(`ruling-${rulingProtestId}`)
    try {
      await ruleProtest(rulingProtestId, { decision: rulingDecision, penalty: rulingDecision === 'Approved' ? rulingPenalty as Penalty : null, placeBehindEntryId: rulingDecision === 'Approved' && rulingPenalty === 'PlaceBehind' ? rulingPlaceBehindId : null, notes: rulingNotes.trim() })
      const [protestList, statusResult] = await Promise.all([getProtestsByRace(raceId), getRaceLiveStatus(raceId)])
      setProtests(protestList); setLiveStatus(statusResult); closeRulingForm(); notify('Đã ghi nhận phán quyết khiếu nại.')
    } catch (actionError) { notify(errorMessage(actionError, 'Không thể xử lý khiếu nại.')) }
    finally { setSavingKey(null) }
  }
  const handleCloseProtestWindow = async () => {
    if (!raceId || raceStatus !== 'Unofficial' || !window.confirm('Đóng cửa sổ khiếu nại sớm? Thao tác này chỉ hợp lệ sau tối thiểu 5 phút kể từ khi chốt kết quả sơ bộ.')) return
    setSavingKey('close-protest-window')
    try { await closeProtestWindow(raceId); setClosedProtestRaceId(raceId); notify('Đã đóng cửa sổ khiếu nại. Admin có thể công bố Official khi đủ các điều kiện còn lại.') }
    catch (actionError) { notify(errorMessage(actionError, 'Không thể đóng cửa sổ khiếu nại.')) }
    finally { setSavingKey(null) }
  }

  if (loading) return <div className="space-y-5" aria-busy="true"><div className="h-24 animate-pulse rounded-xl bg-white" /><div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" /></div>

  return <div className="space-y-6">
    {liveStatus && ['Unofficial', 'Official'].includes(liveStatus.status) && <UnofficialResultsTable liveStatus={liveStatus} />}
    {message && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl">{message}</div>}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Điều hành cuộc đua</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Bàn điều hành Referee</h1><p className="mt-2 text-sm text-slate-500">Chỉ các cuộc đua được Admin phân công mới có thể mở và thao tác.</p></div>{raceId && <button type="button" onClick={() => navigate('/referee/race-console')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Đổi cuộc đua</button>}</div>

    {!raceId ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Cuộc đua được phân công</h2><p className="mt-1 text-xs text-slate-500">Chọn một race để mở bàn điều hành.</p></div>{assignments.length === 0 ? <div className="px-6 py-14 text-center"><p className="font-bold text-slate-700">Chưa có cuộc đua được phân công.</p><p className="mt-1 text-sm text-slate-500">Admin sẽ phân công sau khi bạn được duyệt vào roster.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Giải đấu / vòng</th><th className="px-5 py-3">Race</th><th className="px-5 py-3">Thời gian</th><th className="px-5 py-3">Vai trò</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{assignments.map((item) => <tr key={`${item.raceId}-${item.assignedAt}`}><td className="px-5 py-4"><p className="font-bold text-slate-900">{item.tournamentName ?? '—'}</p><p className="mt-1 text-xs text-slate-500">{item.roundName ?? '—'}</p></td><td className="px-5 py-4 font-bold">#{item.raceNumber ?? item.raceId}</td><td className="whitespace-nowrap px-5 py-4">{formatDateTime(item.scheduledTime)}</td><td className="px-5 py-4">{item.assignmentRole ?? item.role ?? 'Referee'}</td><td className="px-5 py-4"><StatusBadge status={item.raceStatus} /></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => navigate(`/referee/race-console?raceId=${item.raceId}`)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold">Mở bàn điều hành</button></td></tr>)}</tbody></table></div>}</section> : error || !assignment ? <section className="rounded-xl border border-red-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-slate-900">Không thể mở cuộc đua</h2><p role="alert" className="mt-2 text-sm text-red-700">{error || 'Không tìm thấy phân công phù hợp.'}</p><button type="button" onClick={() => navigate('/referee/race-console')} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold">Về danh sách phân công</button></section> : <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-slate-950">{assignment.tournamentName ?? 'Giải đấu'} · Race #{assignment.raceNumber ?? assignment.raceId}</h2><StatusBadge status={raceStatus} /></div><p className="mt-2 text-sm text-slate-500">{assignment.roundName ?? '—'} · {formatDateTime(assignment.scheduledTime)} · {assignment.assignmentRole ?? assignment.role ?? 'Referee'}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void loadConsole(true)} disabled={refreshing} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">{refreshing ? 'Đang tải...' : 'Làm mới'}</button>{raceStatus === 'Upcoming' && <button type="button" onClick={() => void handleConfirmStartingList()} disabled={savingKey === 'starting-list' || entries.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold disabled:opacity-50">{savingKey === 'starting-list' ? 'Đang xác nhận...' : 'Xác nhận starting list'}</button>}{raceStatus === 'Pre-Race' && <button type="button" onClick={() => void handleStartRace()} disabled={savingKey === 'start-race'} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold disabled:opacity-50">{savingKey === 'start-race' ? 'Đang bắt đầu...' : 'Bắt đầu cuộc đua'}</button>}{raceStatus === 'Live' && <><button type="button" onClick={() => { resetViolationForm(); setShowViolationForm(true) }} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900">Ghi nhận vi phạm</button><button type="button" onClick={() => setShowFinishForm((value) => !value)} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white">Chốt kết quả sơ bộ</button></>}</div></div>{raceStatus === 'Unofficial' && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">Kết quả đang ở trạng thái Unofficial và chờ Admin công bố chính thức.</p>}{raceStatus === 'Official' && <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">Kết quả đã được Admin công bố Official. Referee chỉ có quyền xem.</p>}</section>

      {(raceStatus === 'Unofficial' || raceStatus === 'Official') && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">Xử lý khiếu nại</h2><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800">{protests.filter((item) => item.status.toLowerCase() === 'pending').length} đang chờ</span></div><p className="mt-1 text-xs text-slate-500">Khiếu nại mới được tự động cập nhật mỗi 5 giây trong giai đoạn Unofficial.</p></div>{raceStatus === 'Unofficial' && <button type="button" onClick={() => void handleCloseProtestWindow()} disabled={savingKey === 'close-protest-window' || closedProtestRaceId === raceId} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{closedProtestRaceId === raceId ? 'Cửa sổ đã đóng' : savingKey === 'close-protest-window' ? 'Đang đóng...' : 'Đóng cửa sổ khiếu nại sớm'}</button>}</div>
        {protests.length === 0 ? <div className="px-5 py-12 text-center"><p className="font-bold text-slate-700">Chưa có khiếu nại.</p><p className="mt-1 text-sm text-slate-500">Owner/Jockey có tối đa 10 phút sau khi kết quả chuyển sang Unofficial để gửi khiếu nại.</p></div> : <div className="divide-y divide-slate-100">{protests.map((protest) => {
          const accused = liveStatus?.entries.find((entry) => entry.raceEntryId === protest.accusedRaceEntryId)
          const pending = protest.status.toLowerCase() === 'pending'
          const isEditing = rulingRaceId === raceId && rulingProtestId === protest.protestId
          return <article key={protest.protestId} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">Khiếu nại #{protest.protestId}</h3><StatusBadge status={protest.status} />{protest.penaltyApplied && <StatusBadge status={protest.penaltyApplied} />}</div><p className="mt-2 text-sm font-bold text-slate-700">Bị khiếu nại: {accused ? `${accused.horseName} / ${accused.jockeyName}` : `Entry #${protest.accusedRaceEntryId}`}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{protest.description}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>Người gửi #{protest.submittedByUserId}</span><span>Gửi lúc {formatDateTime(protest.submittedAt)}</span>{protest.violationId && <span>Vi phạm liên quan #{protest.violationId}</span>}</div>{!pending && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><strong>Phán quyết:</strong> {protest.refereeDecision ?? protest.status}{protest.penaltyApplied ? ` · ${protest.penaltyApplied}` : ''}{protest.resolvedAt ? ` · ${formatDateTime(protest.resolvedAt)}` : ''}</div>}</div>{raceStatus === 'Unofficial' && pending && !isEditing && <button type="button" onClick={() => openRulingForm(protest)} className="shrink-0 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white">Ra phán quyết</button>}</div>
          {isEditing && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Quyết định<select value={rulingDecision} onChange={(event) => { setRulingDecision(event.target.value as ProtestDecision); setRulingPenalty(''); setRulingPlaceBehindId(null) }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="Approved">Chấp thuận</option><option value="Rejected">Từ chối</option></select></label>{rulingDecision === 'Approved' && <label className="text-sm font-bold text-slate-700">Hình phạt<select value={rulingPenalty} onChange={(event) => { setRulingPenalty(event.target.value as Penalty | ''); setRulingPlaceBehindId(null) }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn hình phạt</option>{PENALTIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}{rulingDecision === 'Approved' && rulingPenalty === 'PlaceBehind' && <label className="text-sm font-bold text-slate-700 md:col-span-2">Xếp sau entry<select value={rulingPlaceBehindId ?? ''} onChange={(event) => setRulingPlaceBehindId(event.target.value ? Number(event.target.value) : null)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn entry mục tiêu</option>{liveStatus?.entries.filter((entry) => entry.raceEntryId !== protest.accusedRaceEntryId && !inactiveEntry(entry)).map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>Hạng {entry.finishPosition ?? '—'} · {entry.horseName} / {entry.jockeyName}</option>)}</select></label>}<label className="text-sm font-bold text-slate-700 md:col-span-2">Ghi chú phán quyết<textarea rows={3} minLength={10} maxLength={500} value={rulingNotes} onChange={(event) => setRulingNotes(event.target.value)} placeholder="Nêu căn cứ ra phán quyết (10–500 ký tự)" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={closeRulingForm} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Hủy</button><button type="button" onClick={() => void handleRuleProtest()} disabled={savingKey === `ruling-${protest.protestId}`} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingKey === `ruling-${protest.protestId}` ? 'Đang xử lý...' : 'Xác nhận phán quyết'}</button></div></div>}
          </article>
        })}</div>}
      </section>}

      {showViolationForm && raceStatus === 'Live' && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">{editingViolationId ? 'Cập nhật vi phạm' : 'Ghi nhận vi phạm'}</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Race entry<select value={violationForm.raceEntryId} onChange={(event) => setViolationForm((prev) => ({ ...prev, raceEntryId: Number(event.target.value) }))} disabled={editingViolationId !== null} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value={0}>Chọn entry hợp lệ</option>{eligibleLiveEntries.map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>GATE {entry.postPosition ?? '—'} · {entry.horseName} / {entry.jockeyName}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Mã vi phạm<select value={violationForm.violationCode} onChange={(event) => setViolationForm((prev) => ({ ...prev, violationCode: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn mã backend hỗ trợ</option>{violationCodes.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Hình phạt<select value={violationForm.penalty} onChange={(event) => setViolationForm((prev) => ({ ...prev, penalty: event.target.value, placeBehindEntryId: undefined }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn hình phạt</option>{PENALTIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>{violationForm.penalty === 'PlaceBehind' && <label className="text-sm font-bold text-slate-700">Xếp sau entry<select value={violationForm.placeBehindEntryId ?? ''} onChange={(event) => setViolationForm((prev) => ({ ...prev, placeBehindEntryId: event.target.value ? Number(event.target.value) : undefined }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal"><option value="">Chọn entry</option>{eligibleLiveEntries.filter((entry) => entry.raceEntryId !== violationForm.raceEntryId).map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>{entry.horseName} / {entry.jockeyName}</option>)}</select></label>}<label className="text-sm font-bold text-slate-700 md:col-span-2">Mô tả<textarea rows={3} value={violationForm.description} onChange={(event) => setViolationForm((prev) => ({ ...prev, description: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal" /></label></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={resetViolationForm} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Hủy</button><button type="button" onClick={() => void handleSaveViolation()} disabled={savingKey === 'violation'} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingKey === 'violation' ? 'Đang lưu...' : 'Lưu vi phạm'}</button></div></section>}

      {showFinishForm && raceStatus === 'Live' && <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-950">Chốt kết quả sơ bộ</h2><p className="mt-1 text-sm text-slate-500">Nhập đủ entry hợp lệ. Đồng hạng được phép theo chuẩn 1,1,3.</p><div className="mt-4 space-y-3">{eligibleLiveEntries.map((entry) => <div key={entry.raceEntryId} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_150px_170px] sm:items-center"><div><p className="font-bold text-slate-900">{entry.horseName}</p><p className="text-xs text-slate-500">{entry.jockeyName}</p></div><input type="number" min={1} step={1} value={finishValues[entry.raceEntryId]?.position ?? ''} onChange={(event) => setFinishValues((prev) => ({ ...prev, [entry.raceEntryId]: { position: event.target.value, time: prev[entry.raceEntryId]?.time ?? '' } }))} placeholder="Thứ hạng" className="rounded-lg border border-slate-300 px-3 py-2" /><input type="number" min={0.01} step={0.01} value={finishValues[entry.raceEntryId]?.time ?? ''} onChange={(event) => setFinishValues((prev) => ({ ...prev, [entry.raceEntryId]: { position: prev[entry.raceEntryId]?.position ?? '', time: event.target.value } }))} placeholder="Thời gian, không bắt buộc" className="rounded-lg border border-slate-300 px-3 py-2" /></div>)}<textarea rows={3} value={finishNotes} onChange={(event) => setFinishNotes(event.target.value)} placeholder="Ghi chú cuộc đua, không bắt buộc" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setShowFinishForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Hủy</button><button type="button" onClick={() => void handleFinishRace()} disabled={savingKey === 'finish-race'} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingKey === 'finish-race' ? 'Đang chốt...' : 'Xác nhận Unofficial'}</button></div></section>}

      <div className="grid gap-6 xl:grid-cols-2"><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Race entries</h2><p className="mt-1 text-xs text-slate-500">Dữ liệu xuất phát và điều kiện y tế do backend cung cấp.</p></div>{entries.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">Chưa có race entry.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">GATE</th><th className="px-4 py-3">Ngựa / Kỵ sĩ</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Kiểm tra</th></tr></thead><tbody className="divide-y divide-slate-100">{entries.map((entry) => <tr key={entry.raceEntryId} className={inactiveEntry({ status: entry.raceEntryStatus ?? entry.status, isWithdrawn: entry.isWithdrawn }) ? 'bg-slate-50 text-slate-500' : ''}><td className="px-4 py-4 font-bold">{entry.postPosition ?? '—'}</td><td className="px-4 py-4"><p className="font-bold text-slate-900">{entry.horseName}</p><p className="text-xs text-slate-500">{entry.jockeyName}</p>{entry.ownerName && <p className="mt-1 text-xs text-slate-400">Owner: {entry.ownerName}</p>}</td><td className="px-4 py-4"><StatusBadge status={entry.isWithdrawn ? 'Withdrawn' : entry.raceEntryStatus ?? entry.status} />{entry.rejectionReason && <p className="mt-2 max-w-48 text-xs font-semibold text-red-700">{entry.rejectionReason}</p>}</td><td className="px-4 py-4 text-xs leading-5 text-slate-600"><p>Danh tính: {entry.horseIdentityCheckStatus ?? 'Chưa kiểm tra'}</p><p>Lâm sàng: {entry.clinicalStatus ?? 'Chưa kiểm tra'}</p><p>Cân trước đua: {entry.preRaceJockeyWeight != null ? `${entry.preRaceJockeyWeight} kg` : 'Chưa cân'}</p></td></tr>)}</tbody></table></div>}</section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Vi phạm</h2><p className="mt-1 text-xs text-slate-500">Chỉ có thể sửa hoặc xóa khi race đang Live.</p></div>{violations.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">Chưa có vi phạm được ghi nhận.</p> : <div className="divide-y divide-slate-100">{violations.map((item, index) => <article key={item.violationId ?? index} className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{item.violationCode}</p><StatusBadge status={item.penalty} /></div><p className="mt-1 text-sm text-slate-600">{item.horseName || item.jockeyName || `Entry ${item.raceEntryId}`}</p><p className="mt-2 text-sm text-slate-500">{item.description || '—'}</p><p className="mt-2 text-xs text-slate-400">{formatDateTime(item.loggedAt ?? item.recordedAt)}</p></div>{raceStatus === 'Live' && item.violationId && <div className="flex gap-2"><button type="button" onClick={() => editViolation(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Sửa</button><button type="button" onClick={() => void handleDeleteViolation(item)} disabled={savingKey === `delete-${item.violationId}`} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">{savingKey === `delete-${item.violationId}` ? 'Đang xóa...' : 'Xóa'}</button></div>}</div></article>)}</div>}</section></div>
      {startingListResult && <div className="space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900"><p className="font-bold">{startingListResult.message || 'Đã xác nhận danh sách xuất phát.'}</p><p className="mt-1">Được xác nhận: {startingListResult.confirmedEntriesCount} · Bị loại: {startingListResult.rejectedEntriesCount}</p></div><ResultTable title="Entries được xác nhận" items={startingListResult.confirmedEntries ?? []} /><ResultTable title="Entries bị loại" items={startingListResult.rejectedEntries ?? []} /></div>}
    </>}
  </div>
}
