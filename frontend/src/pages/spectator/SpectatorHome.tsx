import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SpectatorRaceStatusBadge from '../../components/spectator/SpectatorRaceStatusBadge'
import { getTournaments, type TournamentResponse } from '../../services/tournamentService'
import {
  getMyPredictions,
  getPredictionGateStatus,
  getSpectatorWallet,
  type PredictionGateStatus,
  type SpectatorPrediction,
} from '../../services/spectatorService'

export default function SpectatorHome() {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([])
  const [predictions, setPredictions] = useState<SpectatorPrediction[]>([])
  const [predictionGates, setPredictionGates] = useState<Record<number, PredictionGateStatus | null>>({})
  const [gateErrors, setGateErrors] = useState<Record<number, boolean>>({})
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const [tournamentList, wallet, predictionList] = await Promise.all([
          getTournaments(),
          getSpectatorWallet(),
          getMyPredictions(),
        ])

        const predictionRaceIds = tournamentList.flatMap((tournament) =>
          tournament.rounds.flatMap((round) =>
            round.races
              .filter((race) => ['upcoming', 'pre-race'].includes(race.status.toLowerCase()))
              .map((race) => race.raceId)
          )
        )
        const gateResults = await Promise.all(predictionRaceIds.map(async (raceId) => {
          try {
            return { raceId, gate: await getPredictionGateStatus(raceId), failed: false }
          } catch {
            return { raceId, gate: null, failed: true }
          }
        }))
        const gates: Record<number, PredictionGateStatus | null> = {}
        const failedGates: Record<number, boolean> = {}
        gateResults.forEach(({ raceId, gate, failed }) => {
          gates[raceId] = gate
          failedGates[raceId] = failed
        })

        setTournaments(tournamentList)
        setBalance(wallet.balance)
        setPredictions(predictionList)
        setPredictionGates(gates)
        setGateErrors(failedGates)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu khán giả.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const races = useMemo(
    () => tournaments.flatMap((tournament) => tournament.rounds.flatMap((round) =>
      round.races.map((race) => ({ ...race, tournamentName: tournament.name, roundName: round.name }))
    )),
    [tournaments]
  )
  const correctPredictions = predictions.filter((item) => {
    const status = item.status.toLowerCase()
    return status.includes('win') || status.includes('won')
  }).length

  return (
    <div className="space-y-7 pb-12">
      <header className="overflow-hidden rounded-3xl border border-[#d9c078] bg-[#0a3024] px-6 py-7 text-white shadow-sm sm:px-8">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#e1bc58]">Tổng quan Khán giả</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Không gian khán giả</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/75">Theo dõi cuộc đua, quản lý dự đoán và ví điểm bằng dữ liệu trực tiếp từ hệ thống.</p>
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => navigate('/spectator/prediction')} className="rounded-xl bg-[#cfa73d] px-4 py-2.5 text-sm font-black text-[#082b20] hover:bg-[#e0b94f]">Mở sảnh dự đoán</button><button type="button" onClick={() => navigate('/spectator/leaderboard')} className="rounded-xl border border-white/20 bg-white/[.06] px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10">Xem bảng xếp hạng</button></div>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-gray-500">Cuộc đua</p><p className="mt-2 text-3xl font-black text-gray-900">{loading ? '...' : races.length}</p></div>
        <button type="button" onClick={() => navigate('/spectator/wallet')} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-amber-300"><p className="text-sm font-semibold text-gray-500">Số dư ví</p><p className="mt-2 text-3xl font-black text-amber-600">{loading ? '...' : balance.toLocaleString('vi-VN')} điểm</p></button>
        <button type="button" onClick={() => navigate('/spectator/my-predictions')} className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm hover:border-amber-300"><p className="text-sm font-semibold text-gray-500">Dự đoán đúng</p><p className="mt-2 text-3xl font-black text-emerald-600">{loading ? '...' : `${correctPredictions}/${predictions.length}`}</p></button>
      </section>

      <section className="space-y-4">
        <div><h2 className="text-xl font-bold text-gray-900">Danh sách cuộc đua</h2><p className="text-sm text-gray-500">Chọn theo dõi hoặc dự đoán theo trạng thái hiện tại.</p></div>
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">Đang tải cuộc đua...</div>
        ) : races.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">Hiện chưa có cuộc đua nào.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {races.map((race) => {
              const normalizedStatus = race.status.toLowerCase()
              const isPredictionPhase = normalizedStatus === 'pre-race'
              const isPublished = ['official', 'completed'].includes(normalizedStatus)
              const gate = predictionGates[race.raceId]
              const gateFailed = gateErrors[race.raceId]
              const canPredict = isPredictionPhase
                && gate?.canPredict === true
                && gate.isPostPositionDrawn === true
                && gate.isPredictionGateClosed === false
                && gate.raceStatus.toLowerCase() === 'pre-race'
              const predictionLabel = isPublished
                ? 'Đã công bố kết quả'
                : normalizedStatus === 'cancelled'
                  ? 'Cuộc đua đã hủy'
                  : !['upcoming', 'pre-race'].includes(normalizedStatus)
                    ? 'Đã đóng dự đoán'
                : gateFailed
                  ? 'Không tải được cổng'
                  : !gate
                    ? 'Đang kiểm tra...'
                    : !gate.isPostPositionDrawn
                      ? 'Chưa bốc thăm'
                      : !isPredictionPhase
                        ? 'Chưa chốt danh sách'
                      : gate.isPredictionGateClosed || !gate.canPredict
                        ? 'Cổng đã đóng'
                        : 'Dự đoán'
              return (
                <article key={race.raceId} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-amber-700">{race.tournamentName} · {race.roundName}</p><h3 className="mt-1 text-lg font-black text-gray-900">Race #{race.raceNumber}</h3></div><SpectatorRaceStatusBadge status={race.status} /></div>
                  <p className="mt-3 text-sm text-gray-500">{new Date(race.scheduledTime).toLocaleString('vi-VN')}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => navigate(`/spectator/live-race?raceId=${race.raceId}`)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Theo dõi</button>
                    <button type="button" onClick={() => navigate(`/spectator/prediction?raceId=${race.raceId}`)} disabled={!canPredict} title={canPredict ? 'Mở sảnh dự đoán' : predictionLabel} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500">{predictionLabel}</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
