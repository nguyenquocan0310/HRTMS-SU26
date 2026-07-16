import { useCallback, useEffect, useState } from 'react';
import { getJockeyCareerStats } from '../../services/jockeyService';
import type { JockeyCareerStats } from '../../types/jockey.types';

interface JockeyCareerStatsModalProps {
  jockeyId: number;
  onClose?: () => void;
  textOnly?: boolean;
}

const numberFormatter = new Intl.NumberFormat('vi-VN');
const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const formatNumber = (value: number | null) =>
  value == null ? '—' : numberFormatter.format(value);

const formatRate = (value: number | null) =>
  value == null ? '—' : `${numberFormatter.format(value)}%`;

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : 'Không thể tải thành tích Jockey.';
};

export default function JockeyCareerStatsModal({
  jockeyId,
  onClose,
  textOnly = false,
}: JockeyCareerStatsModalProps) {
  const [stats, setStats] = useState<JockeyCareerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  useEffect(() => {
    let active = true;

    const loadStats = async () => {
      setLoading(true);
      setError('');
      setStats(null);
      try {
        const result = await getJockeyCareerStats(jockeyId);
        if (active) setStats(result);
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadStats();
    return () => {
      active = false;
    };
  }, [jockeyId, retryKey]);

  const items = stats
    ? [
        ['Tổng số cuộc đua', formatNumber(stats.totalRaces)],
        ['Số lần thắng', formatNumber(stats.wins)],
        ['Số lần podium', formatNumber(stats.podiums)],
        ['Tỷ lệ thắng', formatRate(stats.winRate)],
        ['Tỷ lệ podium', formatRate(stats.podiumRate)],
        ['Thứ hạng trung bình', formatNumber(stats.averageFinishPosition)],
        ['Tổng điểm', formatNumber(stats.totalPoints)],
        ['Tổng thu nhập', currencyFormatter.format(stats.totalEarnings)],
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jockey-career-stats-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
              Thành tích Official
            </p>
            <h2 id="jockey-career-stats-title" className="mt-1 text-xl font-extrabold text-gray-900">
              {stats?.fullName || 'Thành tích Jockey'}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Đóng"
          >
            {textOnly ? 'Đóng' : '×'}
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="grid animate-pulse grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="rounded-xl border border-gray-100 p-4">
                  <div className="h-3 w-28 rounded bg-gray-200" />
                  <div className="mt-3 h-7 w-20 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              {!textOnly && <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl" aria-hidden="true">!</span>}
              <p className="font-bold text-gray-900">{error}</p>
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
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  Jockey chưa có cuộc đua Official
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
