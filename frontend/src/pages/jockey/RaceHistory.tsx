import { useCallback, useEffect, useState } from 'react'
import { getMyCareerStats } from '../../services/jockeyService'
import type { JockeyCareerStats } from '../../types/jockey.types'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

const formatRate = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`

export default function RaceHistory() {
  const [stats, setStats] = useState<JockeyCareerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStats(await getMyCareerStats())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được thống kê sự nghiệp.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => { void loadStats() }, 0)
    return () => window.clearTimeout(id)
  }, [loadStats])

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="text-center"><div className="mb-4 inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" /><p className="text-sm text-gray-500">Đang tải thống kê sự nghiệp...</p></div></div>
  }

  if (error || !stats) {
    return <div className="max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-sm"><h2 className="font-bold text-gray-900">Không tải được dữ liệu</h2><p role="alert" className="mt-2 text-sm text-red-600">{error || 'Dữ liệu thống kê không tồn tại.'}</p><button type="button" onClick={() => void loadStats()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Thử lại</button></div>
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Lịch sử thi đấu &amp; Thống kê sự nghiệp</h1><p className="mt-1 text-sm text-gray-500">Các chỉ số chỉ tính từ những cuộc đua đã có kết quả Official.</p></div>

      {stats.totalRaces === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm"><h2 className="text-lg font-bold text-gray-900">Chưa có cuộc đua Official</h2><p className="mt-2 text-sm text-gray-500">Thống kê sẽ xuất hiện sau khi một cuộc đua của bạn được công nhận kết quả chính thức.</p></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Tổng cuộc đua', stats.totalRaces.toLocaleString('vi-VN')],
              ['Chiến thắng', stats.wins.toLocaleString('vi-VN')],
              ['Top 3', stats.podiums.toLocaleString('vi-VN')],
              ['Tổng điểm', stats.totalPoints.toLocaleString('vi-VN')],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold text-blue-600">{value}</p></div>)}
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <dl className="divide-y divide-gray-100">
              <div className="grid grid-cols-2 gap-4 px-6 py-4"><dt className="text-sm font-medium text-gray-500">Tỷ lệ chiến thắng</dt><dd className="text-right text-sm font-bold text-gray-900">{formatRate(stats.winRate)}</dd></div>
              <div className="grid grid-cols-2 gap-4 px-6 py-4"><dt className="text-sm font-medium text-gray-500">Tỷ lệ Top 3</dt><dd className="text-right text-sm font-bold text-gray-900">{formatRate(stats.podiumRate)}</dd></div>
              <div className="grid grid-cols-2 gap-4 px-6 py-4"><dt className="text-sm font-medium text-gray-500">Vị trí về đích trung bình</dt><dd className="text-right text-sm font-bold text-gray-900">{stats.averageFinishPosition?.toFixed(2) ?? '—'}</dd></div>
              <div className="grid grid-cols-2 gap-4 px-6 py-4"><dt className="text-sm font-medium text-gray-500">Tổng tiền thưởng</dt><dd className="text-right text-sm font-bold text-green-700">{formatCurrency(stats.totalEarnings)}</dd></div>
            </dl>
          </div>
        </>
      )}
    </div>
  )
}
