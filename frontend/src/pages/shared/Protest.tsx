import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMyAccountProfile } from '../../services/accountService'
import { getMyJockeyRaceEntries } from '../../services/jockeyService'
import { getMyRaceEntries } from '../../services/ownerService'
import {
  getProtestsByRace,
  getRaceEntriesForProtest,
  submitProtest,
  type ProtestRaceEntry,
} from '../../services/protestService'
import type { Protest as ProtestRecord } from '../../types/protest.types'

interface ProtestProps {
  userRole: 'HorseOwner' | 'Jockey'
}

interface RaceOption {
  raceId: number
  label: string
  status: string
}

const MIN_REASON_LENGTH = 20
const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50'

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  Pending: { label: 'Đang xử lý', cls: 'border-yellow-200 bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500' },
  Approved: { label: 'Chấp thuận', cls: 'border-green-200 bg-green-50 text-green-700', dot: 'bg-green-500' },
  Rejected: { label: 'Bác bỏ', cls: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-500' },
}

function ProtestStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, cls: 'border-gray-200 bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
  return <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${config.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />{config.label}</span>
}

export default function Protest({ userRole }: ProtestProps) {
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [races, setRaces] = useState<RaceOption[]>([])
  const [protests, setProtests] = useState<ProtestRecord[]>([])
  const [raceEntries, setRaceEntries] = useState<ProtestRaceEntry[]>([])
  const [raceId, setRaceId] = useState('')
  const [accusedRaceEntryId, setAccusedRaceEntryId] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  const raceNames = useMemo(
    () => new Map(races.map((race) => [race.raceId, race.label])),
    [races],
  )

  const loadPage = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const account = await getMyAccountProfile<unknown>()
      const raceOptions: RaceOption[] = userRole === 'Jockey'
        ? (await getMyJockeyRaceEntries(1, 100)).items.map((entry) => ({
            raceId: entry.raceId,
            label: `${entry.tournamentName} – ${entry.roundName}, Race #${entry.raceNumber}`,
            status: entry.raceStatus,
          }))
        : (await getMyRaceEntries(undefined, undefined, 1, 100)).map((entry) => ({
            raceId: entry.race.raceId,
            label: `${entry.race.tournamentName} – Race #${entry.race.raceNumber}`,
            status: '',
          }))

      const uniqueRaces = Array.from(new Map(raceOptions.map((race) => [race.raceId, race])).values())
      const protestGroups = await Promise.all(
        uniqueRaces.map((race) => getProtestsByRace(race.raceId)),
      )

      setCurrentUserId(account.userId)
      setRaces(uniqueRaces)
      setProtests(
        protestGroups
          .flat()
          .filter((protest) => protest.submittedByUserId === account.userId)
          .sort((left, right) => new Date(right.submittedAt).getTime() - new Date(left.submittedAt).getTime()),
      )
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Không thể tải dữ liệu khiếu nại.'))
    } finally {
      setLoading(false)
    }
  }, [userRole])

  useEffect(() => {
    const id = window.setTimeout(() => { void loadPage() }, 0)
    return () => window.clearTimeout(id)
  }, [loadPage])

  const selectableRaces = useMemo(
    () => userRole === 'Jockey'
      ? races.filter((race) => race.status.toLowerCase() === 'unofficial')
      : races,
    [races, userRole],
  )

  const handleRaceChange = async (nextRaceId: string) => {
    setRaceId(nextRaceId)
    setAccusedRaceEntryId('')
    setRaceEntries([])
    setFormError('')
    setSuccess('')
    if (!nextRaceId) return

    setEntriesLoading(true)
    try {
      setRaceEntries(await getRaceEntriesForProtest(nextRaceId))
    } catch (error) {
      setFormError(getErrorMessage(error, 'Không tải được danh sách đối tượng trong cuộc đua.'))
    } finally {
      setEntriesLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    setSuccess('')
    if (!raceId) return setFormError('Vui lòng chọn cuộc đua bị khiếu nại.')
    if (!accusedRaceEntryId) return setFormError('Vui lòng chọn đối tượng bị khiếu nại.')
    if (reason.trim().length < MIN_REASON_LENGTH) return setFormError(`Lý do khiếu nại phải có ít nhất ${MIN_REASON_LENGTH} ký tự.`)

    setSubmitting(true)
    try {
      let message = 'Khiếu nại đã được nộp thành công.'
      const created = await submitProtest(
        {
          raceId: Number(raceId),
          accusedRaceEntryId: Number(accusedRaceEntryId),
          violationId: null,
          description: reason.trim(),
        },
        (backendMessage) => { message = backendMessage || message },
      )
      if (created.submittedByUserId === currentUserId) {
        setProtests((current) => [created, ...current])
      }
      setRaceId('')
      setAccusedRaceEntryId('')
      setRaceEntries([])
      setReason('')
      setSuccess(message)
    } catch (error) {
      setFormError(getErrorMessage(error, 'Nộp khiếu nại thất bại.'))
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabel = userRole === 'HorseOwner' ? 'Chủ ngựa' : 'Kỵ sĩ'

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex items-center gap-2"><div><h1 className="text-xl font-bold text-gray-900">Khiếu nại kết quả</h1><p className="mt-0.5 text-sm text-gray-500">Nộp khiếu nại và theo dõi tiến trình xử lý.</p></div><span className="ml-2 rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{roleLabel}</span></div>

      {loadError && <div role="alert" className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{loadError}</span><button type="button" onClick={() => void loadPage()} className="font-semibold underline">Thử lại</button></div>}

      <div className="mb-5 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span><p className="text-sm font-semibold text-gray-700">Nộp khiếu nại mới</p></div>
        <div className="p-5">
          {success && <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{success}</div>}
          {formError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</div>}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <label className="block text-xs font-semibold text-gray-600">Cuộc đua bị khiếu nại <span className="text-red-500">*</span><select value={raceId} onChange={(event) => void handleRaceChange(event.target.value)} disabled={loading || submitting} className={`mt-1.5 ${inputCls}`}><option value="">— Chọn cuộc đua —</option>{selectableRaces.map((race) => <option key={race.raceId} value={race.raceId}>{race.label}</option>)}</select>{!loading && selectableRaces.length === 0 && <span className="mt-1.5 block font-normal text-gray-400">Hiện không có cuộc đua Unofficial đủ điều kiện khiếu nại.</span>}</label>
            <label className="block text-xs font-semibold text-gray-600">Đối tượng bị khiếu nại <span className="text-red-500">*</span><select value={accusedRaceEntryId} onChange={(event) => { setAccusedRaceEntryId(event.target.value); setFormError('') }} disabled={!raceId || entriesLoading || submitting} className={`mt-1.5 ${inputCls}`}><option value="">{entriesLoading ? 'Đang tải đối tượng...' : '— Chọn ngựa / kỵ sĩ —'}</option>{raceEntries.map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>{entry.horseName} — {entry.jockeyName}{entry.postPosition ? ` (Cổng ${entry.postPosition})` : ''}</option>)}</select></label>
            <label className="block text-xs font-semibold text-gray-600">Lý do khiếu nại <span className="text-red-500">*</span> <span className="font-normal text-gray-400">(tối thiểu {MIN_REASON_LENGTH} ký tự)</span><textarea rows={4} value={reason} onChange={(event) => { setReason(event.target.value); setFormError('') }} disabled={submitting} placeholder="Mô tả chi tiết lý do khiếu nại của bạn..." className={`mt-1.5 resize-none ${inputCls}`} /><span className={`mt-1 flex justify-end font-normal ${reason.trim().length < MIN_REASON_LENGTH ? 'text-red-400' : 'text-green-600'}`}>{reason.trim().length}/{MIN_REASON_LENGTH} ký tự tối thiểu</span></label>
            <div className="flex justify-end"><button type="submit" disabled={submitting || loading} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Đang nộp...' : 'Nộp khiếu nại'}</button></div>
          </form>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3"><div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span><p className="text-sm font-semibold text-gray-700">Danh sách khiếu nại đã nộp</p></div><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{protests.length} khiếu nại</span></div>
        {loading ? <div className="py-12 text-center text-sm text-gray-400">Đang tải danh sách khiếu nại...</div> : protests.length === 0 ? <div className="py-12 text-center text-sm text-gray-400">Bạn chưa nộp khiếu nại nào.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-gray-200 bg-gray-50"><tr>{['Mã KN', 'Cuộc đua', 'Ngày nộp', 'Trạng thái', 'Phán quyết'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{protests.map((protest) => <tr key={protest.protestId} className="transition-colors hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">KN-{String(protest.protestId).padStart(3, '0')}</td><td className="px-4 py-3 text-gray-700">{raceNames.get(protest.raceId) || `Race #${protest.raceId}`}</td><td className="px-4 py-3 text-xs text-gray-500">{new Date(protest.submittedAt).toLocaleDateString('vi-VN')}</td><td className="px-4 py-3"><ProtestStatusBadge status={protest.status} /></td><td className="max-w-xs px-4 py-3 text-xs text-gray-600">{protest.refereeDecision || <span className="italic text-gray-400">Chưa có phán quyết</span>}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  )
}
