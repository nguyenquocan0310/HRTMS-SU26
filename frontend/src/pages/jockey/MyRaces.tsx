import { useCallback, useState, useEffect } from 'react';
import type { JockeyRaceEntry } from '../../types/jockey.types';
import { getMyJockeyRaceEntries } from '../../services/jockeyService';

const badgeBase = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap';

const getEntryStatusBadge = (status: string) => {
  let cls = 'bg-gray-50 text-gray-700 border-gray-200';
  let label = status;

  if (status === 'Confirmed') {
    cls = 'bg-green-50 text-green-700 border-green-200';
    label = 'Đã xác nhận';
  } else if (status === 'Pending' || status === 'PendingConf') {
    cls = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    label = 'Chờ xác nhận';
  } else if (status === 'Cancelled' || status === 'Rejected') {
    cls = 'bg-red-50 text-red-700 border-red-200';
    label = status === 'Cancelled' ? 'Đã hủy' : 'Bị từ chối';
  }

  return <span className={`${badgeBase} ${cls}`}>{label}</span>;
};

const getRaceStatusBadge = (status: string) => {
  let cls = 'bg-gray-50 text-gray-700 border-gray-200';
  let label = status;

  if (status === 'Upcoming') {
    cls = 'bg-blue-50 text-blue-700 border-blue-200';
    label = 'Sắp diễn ra';
  } else if (status === 'Active' || status === 'Running') {
    cls = 'bg-green-50 text-green-700 border-green-200';
    label = 'Đang diễn ra';
  } else if (status === 'Completed') {
    cls = 'bg-gray-100 text-gray-700 border-gray-200';
    label = 'Đã kết thúc';
  } else if (status === 'Cancelled') {
    cls = 'bg-red-50 text-red-700 border-red-200';
    label = 'Đã hủy';
  }

  return <span className={`${badgeBase} ${cls}`}>{label}</span>;
};

const getPairingStatusBadge = (status: string) => {
  let cls = 'bg-gray-50 text-gray-700 border-gray-200';
  let label = status;

  if (status === 'Accepted') {
    cls = 'bg-green-50 text-green-700 border-green-200';
    label = 'Đã chấp nhận';
  } else if (status === 'Confirmed') {
    cls = 'bg-blue-50 text-blue-700 border-blue-200';
    label = 'Đã xác nhận ghép cặp';
  } else if (status === 'Pending') {
    cls = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    label = 'Chờ phản hồi';
  } else if (status === 'Declined') {
    cls = 'bg-red-50 text-red-700 border-red-200';
    label = 'Từ chối';
  }

  return <span className={`${badgeBase} ${cls}`}>{label}</span>;
};

export default function MyRaces() {
  const [races, setRaces] = useState<JockeyRaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyRaces = useCallback(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyJockeyRaceEntries(1, 100);
        setRaces(data.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách cuộc đua.');
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => { void fetchMyRaces(); }, 0);
    return () => window.clearTimeout(id);
  }, [fetchMyRaces]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
          <p className="text-sm text-gray-500">Đang tải danh sách cuộc đua...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-6 max-w-xl shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Không tải được dữ liệu</h2>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
        <button
          onClick={() => void fetchMyRaces()}
          className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuộc đua của tôi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Xem danh sách các cuộc đua bạn được phân công và tham gia.
          </p>
        </div>
        <span className="px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 rounded-full self-start">
          {races.length} cuộc đua
        </span>
      </div>

      {races.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Bạn chưa có cuộc đua nào</h2>
          <p className="text-sm text-gray-500 mt-2">
            Các cuộc đua được phân công sẽ hiển thị tại đây sau khi pairing được đưa vào race.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <table className="min-w-[1280px] w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    'Mã entry',
                    'Giải đấu',
                    'Vòng',
                    'Race #',
                    'Giờ đua',
                    'Ngựa',
                    'Chủ ngựa',
                    'Cổng xuất phát',
                    'Trạng thái race',
                    'Trạng thái entry',
                    'Trạng thái pairing',
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {races.map((race) => (
                  <tr key={race.raceEntryId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-xs font-mono text-gray-600 whitespace-nowrap">#{race.raceEntryId}</td>
                    <td className="px-4 py-4 font-medium text-gray-900 max-w-[220px] truncate">{race.tournamentName}</td>
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{race.roundName}</td>
                    <td className="px-4 py-4 text-gray-700 font-semibold whitespace-nowrap">#{race.raceNumber}</td>
                    <td className="px-4 py-4 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(race.scheduledTime).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-800 whitespace-nowrap">{race.horseName}</td>
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">{race.ownerName}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {race.postPosition ? (
                        <span className="inline-flex px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md font-medium text-xs">
                          Cổng {race.postPosition}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Chưa xác định</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{getRaceStatusBadge(race.raceStatus)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{getEntryStatusBadge(race.entryStatus)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{getPairingStatusBadge(race.pairingStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
