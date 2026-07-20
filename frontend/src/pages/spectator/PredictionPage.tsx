import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getTournaments } from '../../services/tournamentService'
import {
  createPrediction,
  getPredictionFormScores,
  getPredictionGateStatus,
  getRaceLiveStatus,
  getSpectatorWallet,
  type PredictionFormScore,
  type PredictionGateStatus,
  type SpectatorWallet,
} from '../../services/spectatorService'

type PredictionHorse = PredictionFormScore & {
  raceEntryStatus: string
  isWithdrawn: boolean
  isEligibleForPrediction: boolean
}

export default function PredictionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const raceId = Number(searchParams.get('raceId'))
  const validRaceId = Number.isInteger(raceId) && raceId > 0
  const [wallet, setWallet] = useState<SpectatorWallet | null>(null)
  const [gate, setGate] = useState<PredictionGateStatus | null>(null)
  const [horses, setHorses] = useState<PredictionHorse[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const [pointsPlaced, setPointsPlaced] = useState('50')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [raceOptions, setRaceOptions] = useState<Array<{
    raceId: number
    raceNumber: number
    scheduledTime: string
    status: string
    tournamentName: string
    roundName: string
    gate: PredictionGateStatus | null
    gateError: boolean
  }>>([])

  const loadPredictionForm = async () => {
    if (!validRaceId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const [walletResult, gateResult, scoreResult, liveStatusResult] = await Promise.all([
        getSpectatorWallet(),
        getPredictionGateStatus(raceId),
        getPredictionFormScores(raceId),
        getRaceLiveStatus(raceId),
      ])
      const liveEntryById = new Map(liveStatusResult.entries.map((entry) => [entry.raceEntryId, entry]))
      const predictionHorses = scoreResult
        .map((score): PredictionHorse => {
          const entry = liveEntryById.get(score.raceEntryId)
          const raceEntryStatus = entry?.status ?? 'Unavailable'
          const isWithdrawn = entry?.isWithdrawn ?? true
          return {
            ...score,
            raceEntryStatus,
            isWithdrawn,
            isEligibleForPrediction: raceEntryStatus.toLowerCase() === 'confirmed' && !isWithdrawn,
          }
        })
        .sort((left, right) => Number(right.isEligibleForPrediction) - Number(left.isEligibleForPrediction) || right.formScore - left.formScore)
      setWallet(walletResult)
      setGate(gateResult)
      setHorses(predictionHorses)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu dự đoán.')
    } finally {
      setLoading(false)
    }
  }

  const loadRaceOptions = async () => {
    try {
      setLoading(true)
      setError('')
      const tournaments = await getTournaments()
      const predictionRaces = tournaments.flatMap((tournament) =>
        tournament.rounds.flatMap((round) =>
          round.races
            .filter((race) => race.status.toLowerCase() === 'pre-race')
            .map((race) => ({
              raceId: race.raceId,
              raceNumber: race.raceNumber,
              scheduledTime: race.scheduledTime,
              status: race.status,
              tournamentName: tournament.name,
              roundName: round.name,
            }))
        )
      )
      const options = await Promise.all(
        predictionRaces.map(async (race) => {
          try {
            return { ...race, gate: await getPredictionGateStatus(race.raceId), gateError: false }
          } catch {
            return { ...race, gate: null, gateError: true }
          }
        })
      )
      setRaceOptions(options)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách cuộc đua.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      setSelectedEntryId(null)
      setMessage('')
      if (validRaceId) {
        void loadPredictionForm()
      } else {
        void loadRaceOptions()
      }
    }, 0)
    return () => window.clearTimeout(loadId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId, validRaceId])

  const selectedHorse = useMemo(
    () => horses.find((item) => item.raceEntryId === selectedEntryId) ?? null,
    [horses, selectedEntryId]
  )
  const selectedHorseIsEligible = Boolean(selectedHorse?.isEligibleForPrediction)
  const balance = wallet?.balance ?? 0
  const canPredict = Boolean(
    gate?.canPredict &&
    gate.isPostPositionDrawn &&
    !gate.isPredictionGateClosed &&
    gate.raceStatus.toLowerCase() === 'pre-race'
  )
  const pointsPlacedValue = pointsPlaced === '' ? 0 : Number(pointsPlaced)
  const validPoints = /^\d+$/.test(pointsPlaced) && Number.isSafeInteger(pointsPlacedValue) && pointsPlacedValue > 0 && pointsPlacedValue <= balance
  const canSubmit = canPredict && selectedEntryId != null && selectedHorseIsEligible && validPoints && !submitting

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit || selectedEntryId == null) return
    const selectedHorseName = selectedHorse?.horseName ?? 'ngựa đã chọn'
    if (!window.confirm(`Xác nhận đặt ${pointsPlacedValue} điểm cho ${selectedHorseName}?`)) return
    try {
      setSubmitting(true)
      setError('')
      setMessage('')
      const result = await createPrediction({ raceId, raceEntryId: selectedEntryId, pointsPlaced: pointsPlacedValue })
      setMessage(`Đã đặt ${pointsPlacedValue.toLocaleString('vi-VN')} điểm cho ${selectedHorseName} thành công. Số dư còn lại: ${result.walletBalanceAfter.toLocaleString('vi-VN')} điểm.`)
      setWallet((current) => current ? { ...current, balance: result.walletBalanceAfter } : current)
      setSelectedEntryId(null)
      setPointsPlaced('')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi dự đoán.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-extrabold text-gray-900">Sảnh dự đoán</h1>
        <p className="mt-1 text-sm text-gray-500">Chọn một ngựa và đặt điểm dự đoán về nhất.</p>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 sm:flex-row sm:items-center sm:justify-between"><span>{message}</span><button type="button" onClick={() => navigate('/spectator/my-predictions')} className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100">Xem lịch sử dự đoán</button></div>}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">Đang tải dữ liệu dự đoán...</div>
      ) : !validRaceId ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Chọn cuộc đua</h2>
              <p className="mt-1 text-sm text-gray-500">Chỉ race đã được Referee chốt danh sách xuất phát mới có thể mở form dự đoán.</p>
            </div>
            <button type="button" onClick={loadRaceOptions} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
              Làm mới danh sách
            </button>
          </div>

          {raceOptions.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
              <p className="font-semibold text-gray-700">Hiện chưa có cuộc đua nào đang mở cho dự đoán.</p>
              <p className="mt-1 text-sm text-gray-400">Hãy quay lại sau khi Referee chốt danh sách xuất phát.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {raceOptions.map((race) => {
                const selectable = Boolean(
                  race.gate?.canPredict &&
                  race.gate.isPostPositionDrawn &&
                  !race.gate.isPredictionGateClosed &&
                  race.gate.raceStatus.toLowerCase() === 'pre-race'
                )
                const gateLabel = race.gateError
                  ? 'Không tải được trạng thái cổng'
                  : !race.gate
                    ? 'Đang kiểm tra...'
                    : race.gate.isPredictionGateClosed || !race.gate.canPredict
                      ? 'Đã đóng'
                      : 'Đang mở'

                return (
                  <article key={race.raceId} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase text-amber-700">{race.tournamentName} · {race.roundName}</p>
                        <h3 className="mt-1 text-lg font-black text-gray-900">Race #{race.raceNumber}</h3>
                        <p className="mt-2 text-sm text-gray-500">{new Date(race.scheduledTime).toLocaleString('vi-VN')}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${selectable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : race.gateError ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                        {gateLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!selectable}
                      onClick={() => navigate(`/spectator/prediction?raceId=${race.raceId}`)}
                      className="mt-5 w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                    >
                      Chọn cuộc đua
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : validRaceId && gate ? (
        <>
          <div>
            <button type="button" onClick={() => navigate('/spectator/prediction')} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
              Chọn cuộc đua khác
            </button>
          </div>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Race</p><p className="mt-2 text-xl font-black text-gray-900">#{raceId}</p></div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Cổng dự đoán</p><p className={`mt-2 text-lg font-black ${canPredict ? 'text-emerald-600' : 'text-red-600'}`}>{canPredict ? 'Đang mở' : 'Đã đóng'}</p></div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Số dư</p><p className="mt-2 text-xl font-black text-amber-600">{balance.toLocaleString('vi-VN')} điểm</p></div>
          </section>

          {!canPredict && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {gate.raceStatus.toLowerCase() !== 'pre-race'
                ? 'Không thể dự đoán: Referee chưa chốt danh sách xuất phát.'
                : 'Không thể dự đoán: cổng dự đoán đã đóng.'}
            </div>
          )}

          <section className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900">Chọn ngựa</h2><p className="text-sm text-gray-500">Điểm phong độ (Form Score) từ 0–100: 40% lịch sử ngựa, 35% lịch sử jockey và 25% kết quả theo loại vòng. Chưa có lịch sử thì điểm bằng 0; đây không phải số điểm đã cược.</p></div>
            {horses.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Chưa có ngựa đủ điều kiện để dự đoán.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {horses.map((horse) => {
                  const selected = selectedEntryId === horse.raceEntryId
                  const eligible = horse.isEligibleForPrediction && !horse.isWithdrawn && horse.raceEntryStatus.toLowerCase() === 'confirmed'
                  const unavailableLabel = horse.raceEntryStatus.toLowerCase() === 'disqualified'
                    ? 'Đã loại'
                    : horse.isWithdrawn || horse.raceEntryStatus.toLowerCase() === 'cancelled'
                      ? 'Không tham gia'
                      : 'Không đủ điều kiện'
                  return (
                    <button type="button" key={horse.raceEntryId} disabled={!canPredict || !eligible} onClick={() => setSelectedEntryId(horse.raceEntryId)} className={`relative rounded-2xl border p-5 text-left transition ${selected ? 'border-amber-500 bg-amber-50 shadow-sm' : eligible ? 'border-gray-200 bg-white hover:border-amber-300' : 'border-red-200 bg-red-50/40'} disabled:cursor-not-allowed disabled:opacity-70`}>
                      {!eligible && <span className="absolute right-4 top-4 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{unavailableLabel}</span>}
                      <p className={`pr-24 text-lg font-bold ${eligible ? 'text-gray-900' : 'text-gray-500'}`}>{horse.horseName}</p>
                      <p className="mt-1 text-sm text-gray-500">Kỵ sĩ: {horse.jockeyName}</p>
                      <div className="mt-4 border-t border-gray-100 pt-3"><p className="text-xs uppercase text-gray-400">Điểm phong độ</p><p className={`text-xl font-black ${eligible ? 'text-amber-700' : 'text-gray-400'}`}>{horse.formScore}</p></div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-end">
              <div><label htmlFor="prediction-points" className="mb-2 block text-sm font-bold text-gray-700">Điểm dự đoán</label><input id="prediction-points" type="text" inputMode="numeric" pattern="[0-9]*" value={pointsPlaced} disabled={!canPredict} onChange={(event) => { const digits = event.target.value.replace(/\D/g, ''); setPointsPlaced(digits.replace(/^0+(?=\d)/, '')) }} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold focus:border-amber-500 focus:outline-none disabled:bg-gray-100" /><p className="mt-1 text-xs text-gray-400">Không được vượt quá số dư hiện tại.</p></div>
              <button type="submit" disabled={!canSubmit} className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{submitting ? 'Đang gửi...' : 'Xác nhận dự đoán Win'}</button>
            </div>
            {!message && canPredict && selectedEntryId == null && <p className="mt-4 text-sm font-semibold text-amber-700">Vui lòng chọn một ngựa trước khi xác nhận.</p>}
            {!message && pointsPlaced !== '' && pointsPlacedValue <= 0 && <p className="mt-2 text-sm font-semibold text-red-600">Điểm dự đoán phải lớn hơn 0.</p>}
            {!message && pointsPlacedValue > balance && <p className="mt-2 text-sm font-semibold text-red-600">Số dư ví không đủ.</p>}
            {selectedHorse && <p className="mt-4 text-sm text-gray-600">Đã chọn: <strong>{selectedHorse.horseName}</strong> · Số dư sau khi đặt: <strong>{(balance - pointsPlacedValue).toLocaleString('vi-VN')} điểm</strong></p>}
          </form>
        </>
      ) : null}
    </div>
  )
}
