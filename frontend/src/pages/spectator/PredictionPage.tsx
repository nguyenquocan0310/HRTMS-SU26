import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createPrediction,
  getPredictionFormScores,
  getPredictionGateStatus,
  getSpectatorWallet,
  type PredictionFormScore,
  type PredictionGateStatus,
  type SpectatorWallet,
} from '../../services/spectatorService'

export default function PredictionPage() {
  const [searchParams] = useSearchParams()
  const raceId = Number(searchParams.get('raceId'))
  const validRaceId = Number.isInteger(raceId) && raceId > 0
  const [wallet, setWallet] = useState<SpectatorWallet | null>(null)
  const [gate, setGate] = useState<PredictionGateStatus | null>(null)
  const [horses, setHorses] = useState<PredictionFormScore[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const [pointsPlaced, setPointsPlaced] = useState(50)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async () => {
    if (!validRaceId) {
      setError('Thiếu raceId hợp lệ. Hãy mở trang dự đoán từ một cuộc đua.')
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError('')
      const [walletResult, gateResult, scoreResult] = await Promise.all([
        getSpectatorWallet(),
        getPredictionGateStatus(raceId),
        getPredictionFormScores(raceId),
      ])
      setWallet(walletResult)
      setGate(gateResult)
      setHorses(scoreResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu dự đoán.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [raceId])

  const selectedHorse = useMemo(
    () => horses.find((item) => item.raceEntryId === selectedEntryId) ?? null,
    [horses, selectedEntryId]
  )
  const balance = wallet?.balance ?? 0
  const canPredict = Boolean(gate?.canPredict && gate.raceStatus.toLowerCase() === 'upcoming')
  const validPoints = Number.isInteger(pointsPlaced) && pointsPlaced > 0 && pointsPlaced <= balance
  const canSubmit = canPredict && selectedEntryId != null && validPoints && !submitting

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit || selectedEntryId == null) return
    if (!window.confirm(`Xác nhận đặt ${pointsPlaced} điểm cho ${selectedHorse?.horseName ?? 'ngựa đã chọn'}?`)) return
    try {
      setSubmitting(true)
      setError('')
      setMessage('')
      const result = await createPrediction({ raceId, raceEntryId: selectedEntryId, pointsPlaced })
      setMessage(`Đã gửi dự đoán thành công. Số dư còn lại: ${result.walletBalanceAfter.toLocaleString('vi-VN')} điểm.`)
      setWallet(await getSpectatorWallet())
      setSelectedEntryId(null)
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
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">Đang tải dữ liệu dự đoán...</div>
      ) : validRaceId && gate ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Race</p><p className="mt-2 text-xl font-black text-gray-900">#{raceId}</p></div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Cổng dự đoán</p><p className={`mt-2 text-lg font-black ${canPredict ? 'text-emerald-600' : 'text-red-600'}`}>{canPredict ? 'Đang mở' : 'Đã đóng'}</p></div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase text-gray-400">Số dư</p><p className="mt-2 text-xl font-black text-amber-600">{balance.toLocaleString('vi-VN')} điểm</p></div>
          </section>

          {!canPredict && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Không thể dự đoán: race đang ở trạng thái {gate.raceStatus} hoặc cổng dự đoán đã đóng.
            </div>
          )}

          <section className="space-y-4">
            <div><h2 className="text-xl font-bold text-gray-900">Chọn ngựa</h2><p className="text-sm text-gray-500">Form score chỉ là dữ liệu tham khảo.</p></div>
            {horses.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Chưa có ngựa đủ điều kiện để dự đoán.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {horses.map((horse) => {
                  const selected = selectedEntryId === horse.raceEntryId
                  return (
                    <button type="button" key={horse.raceEntryId} disabled={!canPredict} onClick={() => setSelectedEntryId(horse.raceEntryId)} className={`rounded-2xl border p-5 text-left transition ${selected ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-gray-200 bg-white hover:border-amber-300'} disabled:cursor-not-allowed disabled:opacity-60`}>
                      <p className="text-lg font-bold text-gray-900">{horse.horseName}</p>
                      <p className="mt-1 text-sm text-gray-500">Kỵ sĩ: {horse.jockeyName}</p>
                      <div className="mt-4 border-t border-gray-100 pt-3"><p className="text-xs uppercase text-gray-400">Form score</p><p className="text-xl font-black text-amber-700">{horse.formScore}</p></div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-end">
              <div><label className="mb-2 block text-sm font-bold text-gray-700">Điểm dự đoán</label><input type="number" min={1} max={balance} value={pointsPlaced} disabled={!canPredict} onChange={(event) => setPointsPlaced(Number(event.target.value))} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold focus:border-amber-500 focus:outline-none disabled:bg-gray-100" /><p className="mt-1 text-xs text-gray-400">Không được vượt quá số dư hiện tại.</p></div>
              <button type="submit" disabled={!canSubmit} className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{submitting ? 'Đang gửi...' : 'Xác nhận dự đoán Win'}</button>
            </div>
            {selectedHorse && <p className="mt-4 text-sm text-gray-600">Đã chọn: <strong>{selectedHorse.horseName}</strong> · Số dư sau khi đặt: <strong>{(balance - pointsPlaced).toLocaleString('vi-VN')} điểm</strong></p>}
          </form>
        </>
      ) : null}
    </div>
  )
}
