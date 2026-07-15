import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyCareerStats } from '../../services/jockeyService';
import type { ApiError } from '../../services/apiClient';
import type { JockeyCareerStats } from '../../types/jockey.types';

const numberFormatter = new Intl.NumberFormat('vi-VN');
const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const formatNumber = (value: number | null) =>
  value == null ? '—' : numberFormatter.format(value);

const formatRate = (value: number | null) =>
  value == null ? '—' : `${numberFormatter.format(value)}%`;

const getStatsError = (error: unknown) => {
  const apiError = error as ApiError;
  if (apiError?.status === 403) {
    return 'Tài khoản hiện tại không có quyền Jockey.';
  }
  if (apiError?.status === 404) return 'Không tìm thấy hồ sơ Jockey';
  return error instanceof Error ? error.message : 'Không thể tải thống kê cá nhân.';
};

export default function JockeyDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<JockeyCareerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await getMyCareerStats();
        if (active) setStats(result);
      } catch (loadError) {
        if (active) {
          setStats(null);
          setError(getStatsError(loadError));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadStats();
    return () => {
      active = false;
    };
  }, [retryKey]);

  const statCards = stats
    ? [
        { title: 'Tổng số cuộc đua', value: formatNumber(stats.totalRaces) },
        { title: 'Số lần thắng', value: formatNumber(stats.wins) },
        { title: 'Số lần podium', value: formatNumber(stats.podiums) },
        { title: 'Tỷ lệ thắng', value: formatRate(stats.winRate) },
        { title: 'Tỷ lệ podium', value: formatRate(stats.podiumRate) },
        { title: 'Thứ hạng trung bình', value: formatNumber(stats.averageFinishPosition) },
        { title: 'Tổng điểm', value: formatNumber(stats.totalPoints) },
        { title: 'Tổng thu nhập', value: currencyFormatter.format(stats.totalEarnings) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Thành tích Official</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Tổng quan sự nghiệp</h1>
        <p className="mt-1 text-sm text-gray-500">
          Thống kê tổng hợp từ các cuộc đua đã công bố kết quả chính thức.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="animate-pulse rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="h-3 w-28 rounded bg-gray-200" />
              <div className="mt-4 h-8 w-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-red-100 bg-white p-8 text-center shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl text-red-700" aria-hidden="true">!</span>
          <p className="font-bold text-gray-900">Không thể tải thống kê cá nhân</p>
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => setRetryKey((value) => value + 1)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700"
          >
            Thử lại
          </button>
        </div>
      ) : stats ? (
        <>
          {stats.totalRaces === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              Jockey chưa có cuộc đua Official
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.title}</p>
                <p className="mt-3 text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Thao tác nhanh</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <button onClick={() => navigate('/jockey/invitations')} className="rounded-md border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100">
            Xem lời mời
          </button>
          <button onClick={() => navigate('/jockey/races')} className="rounded-md border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100">
            Xem cuộc đua
          </button>
          <button onClick={() => navigate('/jockey/history')} className="rounded-md border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Xem lịch sử thi đấu
          </button>
        </div>
      </div>
    </div>
  );
}
