import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getDoctorRaceEntries,
  getMyDoctorRaceAssignments,
  getRaceEntryHealthProfile,
  updateClinicalCheck,
  updateHorseIdentity,
  updatePostRaceWeight,
  updatePreRaceWeight,
  type DoctorRaceAssignment,
  type DoctorRaceEntry,
  type RaceEntryHealthProfile,
} from '../../services/doctorService'

type ActiveTab = 'weigh-in' | 'vet-check' | 'weigh-out'
type IdentityStatus = 'Matched' | 'Mismatch'
type ClinicalStatus = 'Fit' | 'Unfit'

const formatWeight = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : 'Chưa có'

const getFriendlyError = (err: unknown) => {
  const raw = err instanceof Error ? err.message : 'Không thể xử lý thao tác. Vui lòng thử lại.'
  if (raw.includes('RACE_ENTRY_NOT_ELIGIBLE') || raw.toLowerCase().includes('not eligible')) {
    return 'Race entry này đã bị hủy/rút/loại nên không thể cập nhật kiểm tra.'
  }
  return raw
}

const isEntryEligible = (entry: DoctorRaceEntry) => {
  const status = (entry.raceEntryStatus ?? entry.status).toLowerCase()
  return !entry.isEmergencyDisqualified && !['cancelled', 'withdrawn', 'disqualified'].includes(status)
}

const mergeEntryPatch = (entry: DoctorRaceEntry, patch: Partial<DoctorRaceEntry>) => ({
  ...entry,
  ...patch,
  status: patch.raceEntryStatus ?? patch.status ?? entry.status,
  raceEntryStatus: patch.raceEntryStatus ?? patch.status ?? entry.raceEntryStatus,
})

function EntryStatusBadge({ entry }: { entry: DoctorRaceEntry }) {
  const status = entry.raceEntryStatus ?? entry.status
  const isDisqualified = status === 'Disqualified' || entry.isEmergencyDisqualified
  const cls = isDisqualified
    ? 'bg-red-50 text-red-700 border-red-100'
    : 'bg-emerald-50 text-emerald-700 border-emerald-100'

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  )
}

function WeighInResultBadge({ entry }: { entry: DoctorRaceEntry }) {
  const status = entry.raceEntryStatus ?? entry.status
  if (status === 'Disqualified' || entry.isEmergencyDisqualified) {
    return (
      <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        Đã loại
      </span>
    )
  }

  if (entry.isWeightWarning) {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
        Vượt ngưỡng
      </span>
    )
  }

  if (entry.preRaceJockeyWeight != null) {
    return (
      <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        Đã cân
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-500">
      Chưa cân
    </span>
  )
}

function CheckResultLine({
  label,
  value,
  emptyLabel,
}: {
  label: string
  value: string | null | undefined
  emptyLabel: string
}) {
  const normalized = value?.trim()
  const isBad = normalized === 'Mismatch' || normalized === 'Unfit'
  const isGood = normalized === 'Matched' || normalized === 'Fit'
  const cls = isBad
    ? 'border-red-100 bg-red-50 text-red-700'
    : isGood
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : 'border-gray-100 bg-gray-50 text-gray-500'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-gray-500">{label}:</span>
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
        {normalized || emptyLabel}
      </span>
    </div>
  )
}

function VetCheckResultBadges({ entry }: { entry: DoctorRaceEntry }) {
  const status = entry.raceEntryStatus ?? entry.status
  const isDisqualified = status === 'Disqualified' || entry.isEmergencyDisqualified

  return (
    <div className="space-y-1.5">
      <CheckResultLine
        label="Danh tính"
        value={entry.horseIdentityCheckStatus}
        emptyLabel="Chưa kiểm tra"
      />
      <CheckResultLine label="Khám" value={entry.clinicalStatus} emptyLabel="Chưa khám" />
      {isDisqualified && (
        <span className="inline-flex rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
          Đã loại
        </span>
      )}
    </div>
  )
}

export default function PaddockConsole() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<ActiveTab>('weigh-in')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const searchParams = new URLSearchParams(location.search)
  const raceIdParam = searchParams.get('raceId')
  const selectedRaceId = raceIdParam ? Number(raceIdParam) : null
  const hasValidRaceId = typeof selectedRaceId === 'number' && Number.isFinite(selectedRaceId)

  const [selectedRace, setSelectedRace] = useState<DoctorRaceAssignment | null>(null)
  const [raceLoading, setRaceLoading] = useState(false)

  const [entries, setEntries] = useState<DoctorRaceEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [entriesError, setEntriesError] = useState<string | null>(null)

  const [weightInputs, setWeightInputs] = useState<Record<number, string>>({})
  const [postWeightInputs, setPostWeightInputs] = useState<Record<number, string>>({})
  const [identityInputs, setIdentityInputs] = useState<Record<number, IdentityStatus>>({})
  const [clinicalInputs, setClinicalInputs] = useState<Record<number, ClinicalStatus>>({})
  const [unfitReasons, setUnfitReasons] = useState<Record<number, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [healthEntryId, setHealthEntryId] = useState<number | null>(null)
  const [healthProfile, setHealthProfile] = useState<RaceEntryHealthProfile | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 3000)
  }

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      if (!hasValidRaceId || selectedRaceId === null) {
        setSelectedRace(null)
        return
      }

      setRaceLoading(true)
      getMyDoctorRaceAssignments()
        .then((list) => {
          setSelectedRace(list.find((race) => race.raceId === selectedRaceId) ?? null)
        })
        .catch(() => setSelectedRace(null))
        .finally(() => setRaceLoading(false))
    }, 0)
    return () => window.clearTimeout(loadId)
  }, [hasValidRaceId, selectedRaceId])

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      if (!hasValidRaceId || selectedRaceId === null) {
        setEntries([])
        setEntriesError('Không tìm thấy raceId để mở Paddock.')
        return
      }

      setEntriesLoading(true)
      setEntriesError(null)
      getDoctorRaceEntries(selectedRaceId)
        .then((data) => {
        setEntries(data)
        setWeightInputs(
          Object.fromEntries(
            data.map((entry) => [
              entry.raceEntryId,
              entry.preRaceJockeyWeight != null ? String(entry.preRaceJockeyWeight) : '',
            ])
          )
        )
        setPostWeightInputs(
          Object.fromEntries(
            data.map((entry) => [
              entry.raceEntryId,
              entry.postRaceJockeyWeight != null ? String(entry.postRaceJockeyWeight) : '',
            ])
          )
        )
        setIdentityInputs(
          Object.fromEntries(
            data.map((entry) => [
              entry.raceEntryId,
              entry.horseIdentityCheckStatus === 'Mismatch' ? 'Mismatch' : 'Matched',
            ])
          )
        )
        setClinicalInputs(
          Object.fromEntries(
            data.map((entry) => [
              entry.raceEntryId,
              entry.clinicalStatus === 'Unfit' ? 'Unfit' : 'Fit',
            ])
          )
        )
        setUnfitReasons(
          Object.fromEntries(data.map((entry) => [entry.raceEntryId, entry.unfitReason ?? '']))
        )
        })
        .catch((err) => {
          setEntries([])
          setEntriesError(getFriendlyError(err) || 'Không tải được danh sách race entries.')
        })
        .finally(() => setEntriesLoading(false))
    }, 0)
    return () => window.clearTimeout(loadId)
  }, [hasValidRaceId, selectedRaceId])

  useEffect(() => {
    if (healthEntryId === null) return
    const loadId = window.setTimeout(() => {
      setHealthLoading(true)
      setHealthError(null)
      getRaceEntryHealthProfile(healthEntryId)
        .then(setHealthProfile)
        .catch((error) => {
          setHealthProfile(null)
          setHealthError(getFriendlyError(error))
        })
        .finally(() => setHealthLoading(false))
    }, 0)
    return () => window.clearTimeout(loadId)
  }, [healthEntryId])

  const thresholdLabel = useMemo(() => {
    const threshold = entries.find((entry) => entry.thresholdKg != null)?.thresholdKg
    return threshold != null ? threshold.toFixed(1) : 'theo cấu hình'
  }, [entries])
  const preRaceWritable = !selectedRace || ['Upcoming', 'Sắp diễn ra'].includes(selectedRace.raceStatus)
  const postRaceWritable = !selectedRace || ['Live', 'Active', 'Running', 'InProgress', 'Đang diễn ra'].includes(selectedRace.raceStatus)

  const updateEntry = (raceEntryId: number, patch: Partial<DoctorRaceEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.raceEntryId === raceEntryId ? mergeEntryPatch(entry, patch) : entry))
    )
  }

  const handleWeighInConfirm = async (entry: DoctorRaceEntry) => {
    const rawValue = weightInputs[entry.raceEntryId]
    const preRaceJockeyWeight = rawValue === '' ? Number.NaN : Number(rawValue)
    if (!Number.isFinite(preRaceJockeyWeight) || preRaceJockeyWeight < 1 || preRaceJockeyWeight > 300) {
      showToast('Cân nặng trước đua phải từ 1 đến 300 kg.')
      return
    }

    const key = `weight-${entry.raceEntryId}`
    setSavingKey(key)
    try {
      const res = await updatePreRaceWeight(entry.raceEntryId, preRaceJockeyWeight)
      updateEntry(entry.raceEntryId, {
        selfDeclaredWeight: res.selfDeclaredWeight ?? entry.selfDeclaredWeight,
        preRaceJockeyWeight: res.preRaceJockeyWeight ?? res.preRaceWeight ?? preRaceJockeyWeight,
        weightDifference: res.weightDifference ?? entry.weightDifference,
        thresholdKg: res.thresholdKg ?? entry.thresholdKg,
        isWeightWarning: Boolean(res.isWeightWarning),
        message: res.message,
      })
      showToast(res.message ?? `Đã xác nhận Weigh-In cho ${entry.jockeyName}.`)
    } catch (err) {
      showToast(getFriendlyError(err))
    } finally {
      setSavingKey(null)
    }
  }

  const handleHorseIdentityConfirm = async (entry: DoctorRaceEntry) => {
    const horseIdentityCheckStatus = identityInputs[entry.raceEntryId] ?? 'Matched'
    if (
      horseIdentityCheckStatus === 'Mismatch' &&
      !window.confirm('Xác nhận Mismatch có thể loại race entry này. Bạn muốn tiếp tục?')
    ) {
      return
    }

    const key = `identity-${entry.raceEntryId}`
    setSavingKey(key)
    try {
      const res = await updateHorseIdentity(entry.raceEntryId, horseIdentityCheckStatus)
      updateEntry(entry.raceEntryId, {
        horseIdentityCheckStatus:
          res.horseIdentityCheckStatus ?? res.horseIdentityStatus ?? horseIdentityCheckStatus,
        isEmergencyDisqualified: Boolean(res.isEmergencyDisqualified),
        raceEntryStatus: res.raceEntryStatus ?? entry.raceEntryStatus,
        message: res.message,
      })
      showToast(res.message ?? `Đã cập nhật danh tính ngựa ${entry.horseName}.`)
    } catch (err) {
      showToast(getFriendlyError(err))
    } finally {
      setSavingKey(null)
    }
  }

  const handleClinicalConfirm = async (entry: DoctorRaceEntry) => {
    const clinicalStatus = clinicalInputs[entry.raceEntryId] ?? 'Fit'
    const unfitReason = unfitReasons[entry.raceEntryId]?.trim() ?? ''

    if (clinicalStatus === 'Unfit' && unfitReason.length < 20) {
      showToast('Lý do Unfit phải có ít nhất 20 ký tự.')
      return
    }
    if (
      clinicalStatus === 'Unfit' &&
      !window.confirm('Xác nhận Unfit có thể loại race entry này. Bạn muốn tiếp tục?')
    ) {
      return
    }

    const key = `clinical-${entry.raceEntryId}`
    setSavingKey(key)
    try {
      const res = await updateClinicalCheck(
        entry.raceEntryId,
        clinicalStatus,
        clinicalStatus === 'Unfit' ? unfitReason : null
      )
      updateEntry(entry.raceEntryId, {
        clinicalStatus: res.clinicalStatus ?? clinicalStatus,
        unfitReason: res.unfitReason ?? (clinicalStatus === 'Unfit' ? unfitReason : null),
        isEmergencyDisqualified: Boolean(res.isEmergencyDisqualified),
        raceEntryStatus: res.raceEntryStatus ?? entry.raceEntryStatus,
        message: res.message,
      })
      showToast(res.message ?? `Đã cập nhật khám lâm sàng cho ${entry.horseName}.`)
    } catch (err) {
      showToast(getFriendlyError(err))
    } finally {
      setSavingKey(null)
    }
  }

  const openHealthProfile = (raceEntryId: number) => {
    setHealthProfile(null)
    setHealthError(null)
    setHealthEntryId(raceEntryId)
  }

  const closeHealthProfile = () => {
    setHealthEntryId(null)
    setHealthProfile(null)
    setHealthError(null)
  }

  const handleWeighOutConfirm = async (entry: DoctorRaceEntry) => {
    const rawValue = postWeightInputs[entry.raceEntryId]
    const postRaceJockeyWeight = rawValue === '' ? Number.NaN : Number(rawValue)
    if (!Number.isFinite(postRaceJockeyWeight) || postRaceJockeyWeight < 1 || postRaceJockeyWeight > 300) {
      showToast('Cân nặng sau đua phải từ 1 đến 300 kg.')
      return
    }

    const key = `post-weight-${entry.raceEntryId}`
    setSavingKey(key)
    try {
      const response = await updatePostRaceWeight(entry.raceEntryId, postRaceJockeyWeight)
      updateEntry(entry.raceEntryId, {
        preRaceJockeyWeight: response.preRaceJockeyWeight ?? entry.preRaceJockeyWeight,
        postRaceJockeyWeight: response.postRaceJockeyWeight,
        postRaceWeightDifference: response.weightDifference,
        thresholdKg: response.thresholdKg ?? entry.thresholdKg,
        postRaceWeightFlagged: response.isWeightFlagged,
        message: response.message,
      })
      showToast(response.message || `Đã ghi nhận Weigh-Out cho ${entry.jockeyName}.`)
    } catch (error) {
      showToast(getFriendlyError(error))
    } finally {
      setSavingKey(null)
    }
  }

  const renderEntriesState = () => {
    if (entriesLoading) {
      return (
        <div className="flex items-center justify-center py-12 text-sm text-gray-500">
          <span className="mr-3 h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
          Đang tải danh sách entries...
        </div>
      )
    }

    if (entriesError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {entriesError}
        </div>
      )
    }

    if (entries.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="mt-2 text-sm font-semibold text-gray-600">Chưa có race entry nào trong race này.</p>
          <p className="mt-1 text-xs text-gray-400">Entries chỉ có sau khi race đã được bốc thăm.</p>
        </div>
      )
    }

    return null
  }

  const stateBlock = renderEntriesState()

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {toastMessage && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-xs font-semibold text-white shadow-lg">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
            Bàn điều khiển Paddock
          </h1>
          {raceLoading && <p className="mt-1 text-xs text-gray-400">Đang tải thông tin race...</p>}
          {!raceLoading && selectedRace && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{selectedRace.tournamentName}</span>
                {' — '}
                {selectedRace.roundName}
                {' — '}
                <span className="font-mono font-bold text-blue-700">Race #{selectedRace.raceNumber}</span>
              </p>
              <p className="text-xs text-gray-400">
                {new Date(selectedRace.scheduledTime).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
          {!raceLoading && !selectedRace && hasValidRaceId && (
            <p className="mt-1 text-xs text-amber-600">
              Không tìm thấy race #{selectedRaceId} trong danh sách phân công, nhưng vẫn thử tải entries.
            </p>
          )}
          {!hasValidRaceId && (
            <p className="mt-1 text-xs text-red-600">Không tìm thấy raceId để mở Paddock.</p>
          )}
        </div>
        <div className="self-start rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 sm:self-center">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Doctor Paddock</span>
        </div>
      </div>

      <div className="flex overflow-x-auto rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('weigh-in')}
          className={`min-w-48 flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition-all ${
            activeTab === 'weigh-in'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          Cân nặng trước đua (Weigh-In)
        </button>
        <button
          onClick={() => setActiveTab('vet-check')}
          className={`min-w-48 flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition-all ${
            activeTab === 'vet-check'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          Kiểm tra ngựa (Vet Check)
        </button>
        <button
          onClick={() => setActiveTab('weigh-out')}
          className={`min-w-48 flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition-all ${
            activeTab === 'weigh-out'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          Cân nặng sau đua (Weigh-Out)
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {activeTab === 'weigh-in' && (
          <div className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Danh sách Kỵ sĩ cân trước cuộc đua</h2>
              <span className="text-xs text-gray-400">Ngưỡng cảnh báo: {thresholdLabel} kg</span>
            </div>
            {!preRaceWritable && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Cuộc đua không còn ở trạng thái cho phép cập nhật dữ liệu trước đua. Backend vẫn là nguồn xác nhận cuối cùng.
              </p>
            )}

            {stateBlock ?? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Post</th>
                      <th className="px-4 py-3">Kỵ sĩ / Ngựa</th>
                      <th className="px-4 py-3">Cân tự khai</th>
                      <th className="px-4 py-3">Cân thực tế</th>
                      <th className="px-4 py-3">Chênh lệch</th>
                      <th className="px-4 py-3">Kết quả cân</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map((entry) => {
                      const key = `weight-${entry.raceEntryId}`
                      const input = weightInputs[entry.raceEntryId] ?? ''
                      const actual = input === '' ? null : Number(input)
                      const diff =
                        entry.weightDifference ??
                        (actual != null && entry.selfDeclaredWeight != null
                          ? Number((actual - entry.selfDeclaredWeight).toFixed(1))
                          : null)
                      const isExceeded =
                        entry.isWeightWarning ||
                         (diff != null && entry.thresholdKg != null && Math.abs(diff) > entry.thresholdKg)
                      const eligible = isEntryEligible(entry)

                      return (
                        <tr key={entry.raceEntryId} className="transition-colors hover:bg-gray-50/20">
                          <td className="px-4 py-4 font-mono text-xs font-bold text-gray-500">
                            {entry.postPosition ?? '-'}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-900">{entry.jockeyName}</p>
                            <p className="mt-0.5 text-xs text-gray-400">{entry.horseName}</p>
                          </td>
                          <td className="px-4 py-4 font-mono font-medium">
                            {formatWeight(entry.selfDeclaredWeight)}
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              step="0.1"
                              className={`w-28 rounded-lg border bg-gray-50 px-3 py-1.5 text-sm font-semibold transition-all focus:bg-white focus:outline-none focus:ring-2 ${
                                isExceeded
                                  ? 'border-red-500 bg-red-50/50 text-red-700 focus:ring-red-500/20'
                                  : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                              }`}
                              placeholder="Nhập cân"
                              value={input}
                              min="1"
                              max="300"
                              disabled={!preRaceWritable || !eligible || savingKey !== null}
                              onChange={(event) =>
                                setWeightInputs((prev) => ({
                                  ...prev,
                                  [entry.raceEntryId]: event.target.value,
                                }))
                              }
                            />
                          </td>
                          <td className="px-4 py-4">
                            {diff != null ? (
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-bold ${isExceeded ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                                {isExceeded && (
                                  <span className="rounded border border-red-200 bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                    Vượt mức
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs italic text-gray-400">Chưa cân</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <WeighInResultBadge entry={entry} />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => handleWeighInConfirm(entry)}
                              disabled={input === '' || !preRaceWritable || !eligible || savingKey !== null}
                              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              {savingKey === key ? 'Đang lưu...' : entry.preRaceJockeyWeight != null ? 'Cập nhật Weigh-In' : 'Xác nhận Weigh-In'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'vet-check' && (
          <div className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Kiểm tra danh tính ngựa & khám lâm sàng</h2>
              <span className="text-xs text-gray-400">Mismatch hoặc Unfit có thể loại entry</span>
            </div>
            {!preRaceWritable && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Cuộc đua không còn ở trạng thái cho phép xác minh danh tính hoặc khám lâm sàng.
              </p>
            )}

            {stateBlock ?? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Ngựa / Kỵ sĩ</th>
                      <th className="px-4 py-3">Danh tính</th>
                      <th className="px-4 py-3">Khám lâm sàng</th>
                      <th className="px-4 py-3">Lý do Unfit</th>
                      <th className="px-4 py-3">Kết quả kiểm tra</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map((entry) => {
                      const identityKey = `identity-${entry.raceEntryId}`
                      const clinicalKey = `clinical-${entry.raceEntryId}`
                      const clinicalStatus = clinicalInputs[entry.raceEntryId] ?? 'Fit'
                      const eligible = isEntryEligible(entry)

                      return (
                        <tr key={entry.raceEntryId} className="transition-colors hover:bg-gray-50/20">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-900">{entry.horseName}</p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {entry.jockeyName}
                              {entry.horseBreed ? ` - ${entry.horseBreed}` : ''}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400">Post {entry.postPosition ?? '-'}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <select
                                value={identityInputs[entry.raceEntryId] ?? 'Matched'}
                                disabled={!preRaceWritable || !eligible || savingKey !== null}
                                onChange={(event) =>
                                  setIdentityInputs((prev) => ({
                                    ...prev,
                                    [entry.raceEntryId]: event.target.value as IdentityStatus,
                                  }))
                                }
                                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              >
                                <option value="Matched">Matched</option>
                                <option value="Mismatch">Mismatch</option>
                              </select>
                              {entry.horseIdentityCheckStatus && (
                                <span className="text-xs font-semibold text-emerald-700">
                                  {entry.horseIdentityCheckStatus}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={clinicalStatus}
                              disabled={!preRaceWritable || !eligible || savingKey !== null}
                              onChange={(event) =>
                                setClinicalInputs((prev) => ({
                                  ...prev,
                                  [entry.raceEntryId]: event.target.value as ClinicalStatus,
                                }))
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 ${
                                clinicalStatus === 'Unfit'
                                  ? 'border-red-200 bg-red-50 text-red-700 focus:ring-red-500/20'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 focus:ring-emerald-500/20'
                              }`}
                            >
                              <option value="Fit">Fit</option>
                              <option value="Unfit">Unfit</option>
                            </select>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="text"
                              value={unfitReasons[entry.raceEntryId] ?? ''}
                              disabled={clinicalStatus !== 'Unfit' || !preRaceWritable || !eligible || savingKey !== null}
                              onChange={(event) =>
                                setUnfitReasons((prev) => ({
                                  ...prev,
                                  [entry.raceEntryId]: event.target.value,
                                }))
                              }
                              placeholder={clinicalStatus === 'Unfit' ? 'Nhập lý do Unfit' : 'Không cần khi Fit'}
                              className="w-56 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <VetCheckResultBadges entry={entry} />
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleHorseIdentityConfirm(entry)}
                                disabled={!preRaceWritable || !eligible || savingKey !== null}
                                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                {savingKey === identityKey ? 'Đang lưu...' : 'Lưu danh tính'}
                              </button>
                              <button
                                onClick={() => handleClinicalConfirm(entry)}
                                disabled={!preRaceWritable || !eligible || savingKey !== null}
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                {savingKey === clinicalKey ? 'Đang lưu...' : 'Lưu khám'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openHealthProfile(entry.raceEntryId)}
                                disabled={healthLoading}
                                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                              >
                                Xem hồ sơ
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'weigh-out' && (
          <div className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Cân nặng sau đua (Weigh-Out)</h2>
              <span className="text-xs text-gray-400">Chỉ ghi nhận khi cuộc đua đang Live</span>
            </div>
            {!postRaceWritable && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Cuộc đua hiện không ở trạng thái cho phép ghi nhận cân nặng sau đua.
              </p>
            )}
            {stateBlock ?? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Post</th>
                      <th className="px-4 py-3">Kỵ sĩ / Ngựa</th>
                      <th className="px-4 py-3">Cân trước đua</th>
                      <th className="px-4 py-3">Cân sau đua</th>
                      <th className="px-4 py-3">Chênh lệch</th>
                      <th className="px-4 py-3">Kết quả</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map((entry) => {
                      const key = `post-weight-${entry.raceEntryId}`
                      const input = postWeightInputs[entry.raceEntryId] ?? ''
                      const enteredWeight = input === '' ? null : Number(input)
                      const difference = entry.postRaceWeightDifference ?? (
                        enteredWeight != null && entry.preRaceJockeyWeight != null
                          ? Number((enteredWeight - entry.preRaceJockeyWeight).toFixed(1))
                          : null
                      )
                      const eligible = isEntryEligible(entry)
                      return (
                      <tr key={entry.raceEntryId} className="hover:bg-gray-50/30">
                        <td className="px-4 py-4 font-mono text-xs font-bold text-gray-500">
                          {entry.postPosition ?? '-'}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">{entry.jockeyName}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{entry.horseName}</p>
                        </td>
                        <td className="px-4 py-4 font-mono font-medium">
                          {formatWeight(entry.preRaceJockeyWeight)}
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min="1"
                            max="300"
                            step="0.1"
                            value={input}
                            onChange={(event) => setPostWeightInputs((current) => ({
                              ...current,
                              [entry.raceEntryId]: event.target.value,
                            }))}
                            disabled={!postRaceWritable || !eligible || savingKey !== null}
                            placeholder="Nhập cân"
                            className="w-28 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-4 font-mono font-semibold">
                          {difference == null ? 'Chưa có' : `${difference > 0 ? '+' : ''}${difference.toFixed(1)} kg`}
                        </td>
                        <td className="px-4 py-4">
                          {entry.postRaceJockeyWeight == null ? (
                            <EntryStatusBadge entry={entry} />
                          ) : (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              entry.postRaceWeightFlagged
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            }`}>
                              {entry.postRaceWeightFlagged ? 'Backend đánh dấu cảnh báo' : 'Đã ghi nhận'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void handleWeighOutConfirm(entry)}
                            disabled={input === '' || !postRaceWritable || !eligible || savingKey !== null}
                            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            {savingKey === key ? 'Đang lưu...' : entry.postRaceJockeyWeight != null ? 'Cập nhật Weigh-Out' : 'Xác nhận Weigh-Out'}
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {healthEntryId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onClick={closeHealthProfile}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="health-profile-title"
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Dữ liệu API hồ sơ sức khỏe</p>
                <h2 id="health-profile-title" className="mt-1 text-lg font-bold text-gray-900">Chi tiết ngựa và Jockey</h2>
              </div>
              <button
                type="button"
                onClick={closeHealthProfile}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>

            <div className="p-5 sm:p-6">
              {healthLoading && <p className="py-10 text-center text-sm text-gray-500">Đang tải hồ sơ sức khỏe...</p>}
              {!healthLoading && healthError && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{healthError}</p>
              )}
              {!healthLoading && healthProfile && (
                <div className="space-y-6">
                  <div>
                    <h3 className="border-b border-gray-100 pb-2 text-sm font-bold text-gray-900">Thông tin Jockey</h3>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[
                        ['Họ tên', healthProfile.jockeyName],
                        ['Giấy phép', healthProfile.licenseCertificate],
                        ['Kinh nghiệm', `${healthProfile.experienceYears} năm`],
                        ['Nhóm máu', healthProfile.bloodType || 'Chưa có dữ liệu'],
                        ['Tình trạng sức khỏe', healthProfile.healthStatus || 'Chưa có dữ liệu'],
                        ['Cân tự khai', `${healthProfile.selfDeclaredWeight} kg`],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <dt className="text-xs font-medium text-gray-500">{label}</dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-gray-800">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div>
                    <h3 className="border-b border-gray-100 pb-2 text-sm font-bold text-gray-900">Thông tin ngựa</h3>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[
                        ['Tên ngựa', healthProfile.horseName],
                        ['Giống', healthProfile.breed],
                        ['Màu lông', healthProfile.color],
                        ['Giới tính', healthProfile.gender],
                        ['Năm sinh', String(healthProfile.birthYear)],
                        ['Dấu hiệu nhận dạng', healthProfile.identifyingMarks],
                        ['Hồ sơ tiêm chủng', healthProfile.vaccinationRecordRef],
                        ['Ngày xét nghiệm doping', healthProfile.dopingTestDate || 'Chưa có dữ liệu'],
                        ['Kết quả doping', healthProfile.dopingTestResult || 'Chưa có dữ liệu'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <dt className="text-xs font-medium text-gray-500">{label}</dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-gray-800">{value || 'Chưa có dữ liệu'}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div>
                    <h3 className="border-b border-gray-100 pb-2 text-sm font-bold text-gray-900">Kết quả kiểm tra</h3>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[
                        ['Cân trước đua', healthProfile.preRaceJockeyWeight == null ? 'Chưa ghi nhận' : `${healthProfile.preRaceJockeyWeight} kg`],
                        ['Cân sau đua', healthProfile.postRaceJockeyWeight == null ? 'Chưa ghi nhận' : `${healthProfile.postRaceJockeyWeight} kg`],
                        ['Danh tính ngựa', healthProfile.horseIdentityCheckStatus || 'Chưa kiểm tra'],
                        ['Khám lâm sàng', healthProfile.clinicalStatus || 'Chưa kiểm tra'],
                        ['Lý do Unfit', healthProfile.unfitReason || 'Không có'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                          <dt className="text-xs font-medium text-gray-500">{label}</dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-gray-800">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
