import { useEffect, useMemo, useState } from 'react'
import { getMyPredictions, type SpectatorPrediction } from '../../services/spectatorService'

type FilterStatus = 'all' | 'pending' | 'won' | 'lost' | 'refunded'

const normalizeStatus = (status: string): Exclude<FilterStatus, 'all'> => {
  const value = status.toLowerCase()
  if (value.includes('win') || value.includes('won')) return 'won'
  if (value.includes('lose') || value.includes('lost')) return 'lost'
  if (value.includes('refund')) return 'refunded'
  return 'pending'
}

const statusLabel: Record<Exclude<FilterStatus, 'all'>, string> = {
  pending: 'Đang chờ kết quả',
  won: 'Dự đoán đúng',
  lost: 'Dự đoán sai',
  refunded: 'Đã hoàn điểm',
}

export default function MyPredictions() {
  const [predictions, setPredictions] = useState<SpectatorPrediction[]>([])
  const [activeTab, setActiveTab] = useState<FilterStatus>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        setPredictions(await getMyPredictions())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được lịch sử dự đoán.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(
    () => activeTab === 'all' ? predictions : predictions.filter((item) => normalizeStatus(item.status) === activeTab),
    [activeTab, predictions]
  )

  return (
    <div className="space-y-6 pb-12">
      <header className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-extrabold text-gray-900">Lịch sử dự đoán</h1>
        <p className="mt-1 text-sm text-gray-500">Theo dõi các phiếu dự đoán và điểm được trao.</p>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-5 overflow-x-auto border-b border-gray-200">
        {([
          ['all', 'Tất cả'], ['pending', 'Đang chờ'], ['won', 'Dự đoán đúng'], ['lost', 'Dự đoán sai'], ['refunded', 'Hoàn điểm'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-bold ${activeTab === key ? 'border-amber-600 text-amber-800' : 'border-transparent text-gray-500'}`}>{label}</button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Đang tải dự đoán...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-semibold text-gray-700">Bạn chưa có dự đoán nào.</p>
            <p className="mt-1 text-sm text-gray-400">Các dự đoán đã gửi sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-5 py-3">Cuộc đua</th><th className="px-5 py-3">Ngựa</th><th className="px-5 py-3">Loại</th><th className="px-5 py-3 text-right">Điểm đặt</th><th className="px-5 py-3">Trạng thái</th><th className="px-5 py-3 text-right">Điểm nhận</th><th className="px-5 py-3">Ngày tạo</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => {
                  const status = normalizeStatus(item.status)
                  return (
                    <tr key={item.predictionId}>
                      <td className="px-5 py-4 font-semibold text-gray-900">{item.raceName || `Race #${item.raceId}`}</td>
                      <td className="px-5 py-4 text-gray-700">{item.horseName || '—'}</td>
                      <td className="px-5 py-4 text-gray-700">{item.predictionType || 'Win'}</td>
                      <td className="px-5 py-4 text-right font-bold">{item.pointsPlaced.toLocaleString('vi-VN')}</td>
                      <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${status === 'won' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'lost' ? 'border-red-200 bg-red-50 text-red-700' : status === 'refunded' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{statusLabel[status]}</span></td>
                      <td className="px-5 py-4 text-right font-bold text-emerald-600">{item.pointsAwarded?.toLocaleString('vi-VN') ?? '—'}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-500">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
