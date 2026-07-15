import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getDoctorRaceEntryHealthProfile,
  getDoctorRaceEntries,
  getMyDoctorRaceAssignments,
  updateClinicalCheck,
  updateHorseIdentity,
  updatePostRaceWeight,
  updatePreRaceWeight,
  type DoctorRaceAssignment,
  type DoctorRaceEntry,
  type DoctorRaceEntryHealthProfile,
} from '../../services/doctorService'
import JockeyCareerStatsModal from '../../components/jockey/JockeyCareerStatsModal'

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

const mergeEntryPatch = (entry: DoctorRaceEntry, patch: Partial<DoctorRaceEntry>) => ({
  ...entry,
  ...patch,
  status: patch.raceEntryStatus ?? patch.status ?? entry.status,
  raceEntryStatus: patch.raceEntryStatus ?? patch.status ?? entry.raceEntryStatus,
})

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

function WeighOutResultBadge({ entry }: { entry: DoctorRaceEntry }) {
  const status = entry.raceEntryStatus ?? entry.status
  if (status === 'Disqualified' || entry.isEmergencyDisqualified) {
    return (
      <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        Đã loại
      </span>
    )
  }
  if (entry.isPostRaceWeightFlagged) {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        Vượt ngưỡng
      </span>
    )
  }
  if (entry.postRaceJockeyWeight != null) {
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

const displayValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? 'Chưa có' : String(value)

function HealthProfileModal({
  entry,
  profile,
  loading,
  error,
  onClose,
  onViewCareer,
}: {
  entry: DoctorRaceEntry
  profile: DoctorRaceEntryHealthProfile | null
  loading: boolean
  error: string | null
  onClose: () => void
  onViewCareer: (jockeyId: number) => void
}) {
  const position = profile?.postPosition ?? entry.postPosition
  const detailRows = [
    ['Giống ngựa', profile?.breed ?? entry.horseBreed],
    ['Màu sắc', profile?.color],
    ['Giới tính', profile?.gender],
    ['Năm sinh', profile?.birthYear],
    ['Dấu hiệu nhận dạng', profile?.identifyingMarks],
    ['Hồ sơ tiêm chủng', profile?.vaccinationRecordRef],
    ['Kết quả doping', profile?.dopingTestResult],
    ['Ngày kiểm tra doping', profile?.dopingTestDate],
  ] as const
  const jockeyRows = [
    ['Chứng chỉ', profile?.licenseCertificate],
    ['Kinh nghiệm', profile?.experienceYears != null ? `${profile.experienceYears} năm` : null],
    ['Nhóm máu', profile?.bloodType],
    ['Tình trạng sức khỏe', profile?.healthStatus],
    ['Cân tự khai', profile?.selfDeclaredWeight != null ? `${profile.selfDeclaredWeight} kg` : null],
    ['Cân trước đua', profile?.preRaceJockeyWeight != null ? `${profile.preRaceJockeyWeight} kg` : null],
    ['Cân sau đua', profile?.postRaceJockeyWeight != null ? `${profile.postRaceJockeyWeight} kg` : null],
  ] as const
  const rawJockeyId = profile?.jockeyId ?? entry.jockeyId
  const jockeyId = Number(rawJockeyId)
  const canViewCareer = Number.isInteger(jockeyId) && jockeyId > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="health-profile-title"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <h2 id="health-profile-title" className="text-lg font-bold text-gray-900">
              Chi tiết hồ sơ sức khỏe
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {entry.horseName} - {entry.jockeyName} - Post {position ?? 'Chưa có'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Đóng
          </button>
        </div>

        <div className="p-5">
          {loading && <p className="py-10 text-center text-sm text-gray-500">Đang tải hồ sơ sức khỏe...</p>}
          {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {!loading && !error && profile && (
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">Thông tin ngựa</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {detailRows.map(([label, value]) => (
                    <div key={label} className="rounded-md border border-gray-200 p-3">
                      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{displayValue(value)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">Thông tin kỵ sĩ</h3>
                  {canViewCareer && (
                    <button
                      type="button"
                      onClick={() => onViewCareer(jockeyId)}
                      className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      Xem thành tích Jockey
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {jockeyRows.map(([label, value]) => (
                    <div key={label} className="rounded-md border border-gray-200 p-3">
                      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{displayValue(value)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">Kết quả kiểm tra Doctor</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-md border border-gray-200 p-3"><CheckResultLine label="Danh tính" value={profile.horseIdentityCheckStatus} emptyLabel="Chưa kiểm tra" /></div>
                  <div className="rounded-md border border-gray-200 p-3"><CheckResultLine label="Khám" value={profile.clinicalStatus} emptyLabel="Chưa khám" /></div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500">Lý do Unfit</p>
                    <p className="mt-1 text-sm text-gray-900">{displayValue(profile.unfitReason)}</p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
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
  const [detailEntry, setDetailEntry] = useState<DoctorRaceEntry | null>(null)
  const [detailProfile, setDetailProfile] = useState<DoctorRaceEntryHealthProfile | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [careerJockeyId, setCareerJockeyId] = useState<number | null>(null)

  const showToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 3000)
  }

  useEffect(() => {
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
  }, [hasValidRaceId, selectedRaceId])

  useEffect(() => {
    if (!hasValidRaceId || selectedRaceId === null) {
      setEntries([])
      setEntriesError('Không tìm thấy raceId để mở Paddock.')
      return
    }

    setEntriesLoading(true)
    setEntriesError(null)
    getDoctorRaceEntries(selectedRaceId)
      .then(async (data) => {
        const profiles = await Promise.all(
          data.map(async (entry) => {
            try {
              return await getDoctorRaceEntryHealthProfile(entry.raceEntryId)
            } catch {
              return null
            }
          })
        )
        const hydratedData = data.map((entry, index) =>
          profiles[index] ? mergeEntryPatch(entry, profiles[index]!) : entry
        )
        setEntries(hydratedData)
        setWeightInputs(
          Object.fromEntries(
            hydratedData.map((entry) => [
              entry.raceEntryId,
              entry.preRaceJockeyWeight != null ? String(entry.preRaceJockeyWeight) : '',
            ])
          )
        )
        setPostWeightInputs(
          Object.fromEntries(
            hydratedData.map((entry) => [
              entry.raceEntryId,
              entry.postRaceJockeyWeight != null ? String(entry.postRaceJockeyWeight) : '',
            ])
          )
        )
        setIdentityInputs(
          Object.fromEntries(
            hydratedData.map((entry) => [
              entry.raceEntryId,
              entry.horseIdentityCheckStatus === 'Mismatch' ? 'Mismatch' : 'Matched',
            ])
          )
        )
        setClinicalInputs(
          Object.fromEntries(
            hydratedData.map((entry) => [
              entry.raceEntryId,
              entry.clinicalStatus === 'Unfit' ? 'Unfit' : 'Fit',
            ])
          )
        )
        setUnfitReasons(
          Object.fromEntries(hydratedData.map((entry) => [entry.raceEntryId, entry.unfitReason ?? '']))
        )
      })
      .catch((err) => {
        setEntries([])
        setEntriesError(getFriendlyError(err) || 'Không tải được danh sách race entries.')
      })
      .finally(() => setEntriesLoading(false))
  }, [hasValidRaceId, selectedRaceId])

  const thresholdLabel = useMemo(() => {
    const threshold = entries.find((entry) => entry.thresholdKg != null)?.thresholdKg
    return threshold != null ? threshold.toFixed(1) : 'theo cấu hình'
  }, [entries])

  const updateEntry = (raceEntryId: number, patch: Partial<DoctorRaceEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.raceEntryId === raceEntryId ? mergeEntryPatch(entry, patch) : entry))
    )
  }

  const refreshEntryHealthProfile = async (raceEntryId: number) => {
    try {
      const profile = await getDoctorRaceEntryHealthProfile(raceEntryId)
      updateEntry(raceEntryId, profile)

      if (profile.preRaceJockeyWeight !== undefined) {
        setWeightInputs((prev) => ({
          ...prev,
          [raceEntryId]:
            profile.preRaceJockeyWeight != null ? String(profile.preRaceJockeyWeight) : '',
        }))
      }
      if (profile.postRaceJockeyWeight !== undefined) {
        setPostWeightInputs((prev) => ({
          ...prev,
          [raceEntryId]:
            profile.postRaceJockeyWeight != null ? String(profile.postRaceJockeyWeight) : '',
        }))
      }
      if (
        profile.horseIdentityCheckStatus === 'Matched' ||
        profile.horseIdentityCheckStatus === 'Mismatch'
      ) {
        setIdentityInputs((prev) => ({
          ...prev,
          [raceEntryId]: profile.horseIdentityCheckStatus as IdentityStatus,
        }))
      }
      if (profile.clinicalStatus === 'Fit' || profile.clinicalStatus === 'Unfit') {
        setClinicalInputs((prev) => ({
          ...prev,
          [raceEntryId]: profile.clinicalStatus as ClinicalStatus,
        }))
      }
      if (profile.unfitReason !== undefined) {
        setUnfitReasons((prev) => ({
          ...prev,
          [raceEntryId]: profile.unfitReason ?? '',
        }))
      }

      return null
    } catch (err) {
      return getFriendlyError(err)
    }
  }

  const handleWeighInConfirm = async (entry: DoctorRaceEntry) => {
    const rawValue = weightInputs[entry.raceEntryId]
    const preRaceJockeyWeight = rawValue === '' ? Number.NaN : Number(rawValue)
    if (!Number.isFinite(preRaceJockeyWeight) || preRaceJockeyWeight <= 0) {
      showToast('Vui lòng nhập cân nặng trước đua hợp lệ.')
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
      const syncError = await refreshEntryHealthProfile(entry.raceEntryId)
      showToast(
        syncError
          ? `Đã lưu Weigh-In nhưng chưa đồng bộ được hồ sơ sức khỏe: ${syncError}`
          : res.message ?? `Đã xác nhận Weigh-In cho ${entry.jockeyName}.`
      )
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
      const syncError = await refreshEntryHealthProfile(entry.raceEntryId)
      showToast(
        syncError
          ? `Đã lưu danh tính nhưng chưa đồng bộ được hồ sơ sức khỏe: ${syncError}`
          : res.message ?? `Đã cập nhật danh tính ngựa ${entry.horseName}.`
      )
    } catch (err) {
      showToast(getFriendlyError(err))
    } finally {
      setSavingKey(null)
    }
  }

  const openHealthProfile = async (entry: DoctorRaceEntry) => {
    setDetailEntry(entry)
    setDetailProfile(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      setDetailProfile(await getDoctorRaceEntryHealthProfile(entry.raceEntryId))
    } catch (err) {
      setDetailError(getFriendlyError(err))
    } finally {
      setDetailLoading(false)
    }
  }

  const handleWeighOutConfirm = async (entry: DoctorRaceEntry) => {
    const rawValue = postWeightInputs[entry.raceEntryId]
    const postRaceJockeyWeight = rawValue === '' ? Number.NaN : Number(rawValue)
    if (!Number.isFinite(postRaceJockeyWeight) || postRaceJockeyWeight <= 0) {
      showToast('Vui lòng nhập cân nặng sau đua hợp lệ.')
      return
    }

    const key = `post-weight-${entry.raceEntryId}`
    setSavingKey(key)
    try {
      const res = await updatePostRaceWeight(entry.raceEntryId, postRaceJockeyWeight)
      updateEntry(entry.raceEntryId, {
        postRaceJockeyWeight: res.postRaceJockeyWeight ?? postRaceJockeyWeight,
        postRaceWeightDifference: res.weightDifference ?? entry.postRaceWeightDifference,
        postRaceWeightThresholdKg: res.thresholdKg ?? entry.postRaceWeightThresholdKg,
        isPostRaceWeightFlagged: Boolean(res.isWeightFlagged),
        message: res.message,
      })
      const syncError = await refreshEntryHealthProfile(entry.raceEntryId)
      showToast(
        syncError
          ? `Đã lưu cân sau đua nhưng chưa đồng bộ được hồ sơ sức khỏe: ${syncError}`
          : res.message ?? `Đã xác nhận cân sau đua cho ${entry.jockeyName}.`
      )
    } catch (err) {
      showToast(getFriendlyError(err))
    } finally {
      setSavingKey(null)
    }
  }

  const handleClinicalConfirm = async (entry: DoctorRaceEntry) => {
    const clinicalStatus = clinicalInputs[entry.raceEntryId] ?? 'Fit'
    const unfitReason = unfitReasons[entry.raceEntryId]?.trim() ?? ''

    if (clinicalStatus === 'Unfit' && unfitReason.length === 0) {
      showToast('Vui lòng nhập lý do khi kết luận Unfit.')
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
      const syncError = await refreshEntryHealthProfile(entry.raceEntryId)
      showToast(
        syncError
          ? `Đã lưu khám lâm sàng nhưng chưa đồng bộ được hồ sơ sức khỏe: ${syncError}`
          : res.message ?? `Đã cập nhật khám lâm sàng cho ${entry.horseName}.`
      )
    } catch (err) {
      showToast(getFriendlyError(err))
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
        <div className="flex items-center gap-2 self-start rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 sm:self-center">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Doctor Paddock</span>
        </div>
      </div>

      <div className="flex rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('weigh-in')}
          className={`flex-1 rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
            activeTab === 'weigh-in'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          Cân nặng trước đua (Weigh-In)
        </button>
        <button
          onClick={() => setActiveTab('vet-check')}
          className={`flex-1 rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
            activeTab === 'vet-check'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          Kiểm tra ngựa (Vet Check)
        </button>
        <button
          onClick={() => setActiveTab('weigh-out')}
          className={`flex-1 rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
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

                      return (
                        <tr key={entry.raceEntryId} className="transition-colors hover:bg-gray-50/20">
                          <td className="px-4 py-4 font-mono text-xs font-bold text-gray-500">
                            {entry.postPosition ?? '-'}
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-900">{entry.jockeyName}</p>
                            <p className="mt-0.5 text-xs text-gray-400">{entry.horseName}</p>
                            <button
                              type="button"
                              onClick={() => openHealthProfile(entry)}
                              className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              Xem chi tiết
                            </button>
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
                              disabled={input === '' || savingKey === key}
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

                      return (
                        <tr key={entry.raceEntryId} className="transition-colors hover:bg-gray-50/20">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-900">{entry.horseName}</p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {entry.jockeyName}
                              {entry.horseBreed ? ` - ${entry.horseBreed}` : ''}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400">Post {entry.postPosition ?? '-'}</p>
                            <button
                              type="button"
                              onClick={() => openHealthProfile(entry)}
                              className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              Xem chi tiết
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <select
                                value={identityInputs[entry.raceEntryId] ?? 'Matched'}
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
                              disabled={clinicalStatus !== 'Unfit'}
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
                                disabled={savingKey === identityKey}
                                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                {savingKey === identityKey ? 'Đang lưu...' : 'Lưu danh tính'}
                              </button>
                              <button
                                onClick={() => handleClinicalConfirm(entry)}
                                disabled={savingKey === clinicalKey}
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                {savingKey === clinicalKey ? 'Đang lưu...' : 'Lưu khám'}
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
              <span className="text-xs text-gray-400">Ngưỡng theo cấu hình giải đấu</span>
            </div>
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
                      <th className="px-4 py-3">Kết quả cân</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map((entry) => {
                      const key = `post-weight-${entry.raceEntryId}`
                      const input = postWeightInputs[entry.raceEntryId] ?? ''
                      const actual = input === '' ? null : Number(input)
                      const difference =
                        entry.postRaceWeightDifference ??
                        (actual != null && entry.preRaceJockeyWeight != null
                          ? Number((entry.preRaceJockeyWeight - actual).toFixed(1))
                          : null)
                      const threshold = entry.postRaceWeightThresholdKg
                      const isFlagged =
                        entry.isPostRaceWeightFlagged ||
                        (difference != null && threshold != null && Math.abs(difference) > threshold)

                      return <tr key={entry.raceEntryId}>
                        <td className="px-4 py-4 font-mono text-xs font-bold text-gray-500">
                          {entry.postPosition ?? '-'}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">{entry.jockeyName}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{entry.horseName}</p>
                          <button
                            type="button"
                            onClick={() => openHealthProfile(entry)}
                            className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            Xem chi tiết
                          </button>
                        </td>
                        <td className="px-4 py-4 font-mono font-medium">
                          {formatWeight(entry.preRaceJockeyWeight)}
                        </td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={input}
                            onChange={(event) =>
                              setPostWeightInputs((prev) => ({
                                ...prev,
                                [entry.raceEntryId]: event.target.value,
                              }))
                            }
                            placeholder="Nhập cân"
                            className={`w-28 rounded-lg border bg-gray-50 px-3 py-1.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 ${
                              isFlagged
                                ? 'border-red-500 bg-red-50/50 text-red-700 focus:ring-red-500/20'
                                : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                            }`}
                          />
                        </td>
                        <td className="px-4 py-4">
                          {difference != null ? (
                            <span className={`font-mono font-bold ${isFlagged ? 'text-red-600' : 'text-emerald-600'}`}>
                              {difference > 0 ? `+${difference}` : difference}
                            </span>
                          ) : (
                            <span className="text-xs italic text-gray-400">Chưa cân</span>
                          )}
                        </td>
                        <td className="px-4 py-4"><WeighOutResultBadge entry={{ ...entry, isPostRaceWeightFlagged: isFlagged }} /></td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => handleWeighOutConfirm(entry)}
                            disabled={input === '' || savingKey === key}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            {savingKey === key
                              ? 'Đang lưu...'
                              : entry.postRaceJockeyWeight != null
                                ? 'Cập nhật cân sau đua'
                                : 'Xác nhận cân sau đua'}
                          </button>
                        </td>
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {detailEntry && (
        <HealthProfileModal
          entry={detailEntry}
          profile={detailProfile}
          loading={detailLoading}
          error={detailError}
          onViewCareer={setCareerJockeyId}
          onClose={() => {
            setDetailEntry(null)
            setDetailProfile(null)
            setDetailError(null)
          }}
        />
      )}
      {careerJockeyId != null && (
        <JockeyCareerStatsModal
          jockeyId={careerJockeyId}
          onClose={() => setCareerJockeyId(null)}
        />
      )}
    </div>
  )
}
