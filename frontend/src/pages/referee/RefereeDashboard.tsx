import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMyRefereeRaceAssignments,
  type RefereeRaceAssignment,
} from '../../services/refereeService';

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Chưa có lịch';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status: string | null | undefined) {
  const value = status || 'Upcoming';
  const cls =
    value === 'Live' || value === 'In-Progress'
      ? 'border-red-100 bg-red-50 text-red-700'
      : value === 'Completed' || value === 'Official'
        ? 'border-gray-200 bg-gray-100 text-gray-600'
        : value === 'Unofficial'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-blue-100 bg-blue-50 text-blue-700';

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>{value}</span>;
}

function roleBadge(role: string | null | undefined) {
  const value = role || 'Referee';
  const isLead = value.toLowerCase().includes('lead') || value.toLowerCase().includes('chính');
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isLead
          ? 'border-blue-100 bg-blue-50 text-blue-700'
          : 'border-gray-200 bg-gray-50 text-gray-600'
      }`}
    >
      {value}
    </span>
  );
}

export default function RefereeDashboard() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<RefereeRaceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setAssignments(await getMyRefereeRaceAssignments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách phân công.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const stats = useMemo(() => {
    const upcoming = assignments.filter((item) => (item.raceStatus ?? 'Upcoming') === 'Upcoming').length;
    const live = assignments.filter((item) => ['Live', 'In-Progress'].includes(item.raceStatus ?? '')).length;
    const completed = assignments.filter((item) => ['Completed', 'Official'].includes(item.raceStatus ?? '')).length;
    return { total: assignments.length, upcoming, live, completed };
  }, [assignments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan trọng tài</h1>
          <p className="mt-1 text-sm text-gray-500">
            Danh sách race được phân công và thao tác pre-race đang được backend hỗ trợ.
          </p>
        </div>
        <button
          onClick={loadAssignments}
          disabled={loading}
          className="self-start rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          Làm mới
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: 'Race được phân công', value: stats.total },
          { label: 'Sắp diễn ra', value: stats.upcoming },
          { label: 'Đang diễn ra', value: stats.live },
          { label: 'Đã hoàn thành', value: stats.completed },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Race được phân công</h2>
            <p className="mt-1 text-xs text-gray-500">Mở console để xem entries và chạy Independence Check.</p>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Đang tải phân công...</div>
        ) : error ? (
          <div className="m-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-gray-700">Chưa có race nào được phân công.</p>
            <p className="mt-1 text-xs text-gray-400">
              Referee cần đăng ký giải, được Admin duyệt roster, rồi Admin assign vào race.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Giải đấu / vòng</th>
                  <th className="px-5 py-3 font-semibold">Race</th>
                  <th className="px-5 py-3 font-semibold">Thời gian</th>
                  <th className="px-5 py-3 font-semibold">Vai trò</th>
                  <th className="px-5 py-3 font-semibold">Trạng thái</th>
                  <th className="px-5 py-3 text-right font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((item) => (
                  <tr key={`${item.raceId}-${item.assignedAt}`} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{item.tournamentName ?? 'Tournament'}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{item.roundName ?? 'Round'}</p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-gray-700">
                      #{item.raceNumber ?? item.raceId}
                    </td>
                    <td className="px-5 py-4 text-gray-700">{formatDateTime(item.scheduledTime)}</td>
                    <td className="px-5 py-4">{roleBadge(item.assignmentRole ?? item.role)}</td>
                    <td className="px-5 py-4">{statusBadge(item.raceStatus)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => navigate(`/referee/race-console?raceId=${item.raceId}`)}
                        className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        Mở Race Console
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
