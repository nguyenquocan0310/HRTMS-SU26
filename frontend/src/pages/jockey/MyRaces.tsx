import React, { useState, useEffect } from 'react';
import type { JockeyRaceEntry } from '../../types/jockey.types';
import { getMyJockeyRaceEntries } from '../../services/jockeyService';

// ─── Status badge formatters ─────────────────────────────────────────────────

const getEntryStatusBadge = (status: string) => {
  let bg = 'bg-gray-100 text-gray-800';
  let label = status;
  
  if (status === 'Confirmed') {
    bg = 'bg-green-100 text-green-800';
    label = 'Đã xác nhận';
  } else if (status === 'Pending' || status === 'PendingConf') {
    bg = 'bg-yellow-100 text-yellow-800';
    label = 'Chờ xác nhận';
  } else if (status === 'Cancelled' || status === 'Rejected') {
    bg = 'bg-red-100 text-red-800';
    label = status === 'Cancelled' ? 'Đã hủy' : 'Bị từ chối';
  }
  
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${bg}`}>{label}</span>;
};

const getRaceStatusBadge = (status: string) => {
  let bg = 'bg-gray-100 text-gray-800';
  let label = status;
  
  if (status === 'Upcoming') {
    bg = 'bg-blue-100 text-blue-850';
    label = 'Sắp diễn ra';
  } else if (status === 'Active' || status === 'Running') {
    bg = 'bg-green-100 text-green-800';
    label = 'Đang diễn ra';
  } else if (status === 'Completed') {
    bg = 'bg-gray-200 text-gray-800';
    label = 'Đã kết thúc';
  }
  
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${bg}`}>{label}</span>;
};

const getPairingStatusBadge = (status: string) => {
  let bg = 'bg-gray-100 text-gray-800';
  let label = status;
  
  if (status === 'Accepted') {
    bg = 'bg-green-100 text-green-800';
    label = 'Đã chấp nhận';
  } else if (status === 'Pending') {
    bg = 'bg-yellow-100 text-yellow-800';
    label = 'Chờ phản hồi';
  } else if (status === 'Declined') {
    bg = 'bg-red-100 text-red-800';
    label = 'Từ chối';
  }
  
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${bg}`}>{label}</span>;
};

const getIndependenceCheckBadge = (status: string) => {
  let bg = 'bg-gray-100 text-gray-800';
  let label = status;
  
  if (status === 'NotChecked') {
    bg = 'bg-yellow-100 text-yellow-800';
    label = 'Chưa kiểm tra';
  } else if (status === 'Checked' || status === 'Approved' || status === 'Passed') {
    bg = 'bg-green-100 text-green-800';
    label = 'Đạt';
  } else if (status === 'Failed') {
    bg = 'bg-red-100 text-red-800';
    label = 'Không đạt';
  }
  
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${bg}`}>{label}</span>;
};

export default function MyRaces() {
  const [races, setRaces] = useState<JockeyRaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyRaces = async () => {
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
    };

    fetchMyRaces();
  }, []);

  // Trạng thái đang tải
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 text-base">Đang tải danh sách cuộc đua...</p>
        </div>
      </div>
    );
  }

  // Trạng thái lỗi
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center bg-white border border-red-200 rounded-xl p-8 max-w-md shadow-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Đã xảy ra lỗi</h2>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Trạng thái rỗng
  if (races.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-4">🏁</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Bạn chưa có cuộc đua nào
          </h2>
          <p className="text-gray-600 text-sm">
            Hãy chấp nhận lời mời để được phân công và tham gia vào các cuộc đua sắp tới.
          </p>
        </div>
      </div>
    );
  }

  // Danh sách cuộc đua
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Tiêu đề */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Cuộc đua của tôi
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Xem danh sách các cuộc đua bạn được phân công và tham gia
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 rounded-full self-start">
            {races.length} cuộc đua
          </span>
        </div>

        {/* Bảng danh sách */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Tiêu đề bảng */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Mã Entry
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Giải đấu
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Vòng
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Race #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Giờ đua
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Ngựa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Chủ ngựa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Cổng xuất phát
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Trạng thái Race
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Trạng thái Entry
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Trạng thái Pairing
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Kiểm tra độc lập
                  </th>
                </tr>
              </thead>

              {/* Nội dung bảng */}
              <tbody className="divide-y divide-gray-200">
                {races.map((race) => (
                  <tr key={race.raceEntryId} className="hover:bg-gray-50 transition-colors">
                    {/* Mã Entry */}
                    <td className="px-4 py-4 text-xs font-mono text-gray-600 whitespace-nowrap">
                      #{race.raceEntryId}
                    </td>

                    {/* Giải đấu */}
                    <td className="px-4 py-4 font-medium text-gray-900 max-w-[200px] truncate">
                      {race.tournamentName}
                    </td>

                    {/* Vòng */}
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                      {race.roundName}
                    </td>

                    {/* Race # */}
                    <td className="px-4 py-4 text-gray-700 font-semibold whitespace-nowrap">
                      #{race.raceNumber}
                    </td>

                    {/* Giờ đua */}
                    <td className="px-4 py-4 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(race.scheduledTime).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Tên ngựa */}
                    <td className="px-4 py-4 font-medium text-gray-800 whitespace-nowrap">
                      {race.horseName}
                    </td>

                    {/* Chủ ngựa */}
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                      {race.ownerName}
                    </td>

                    {/* Cổng xuất phát */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {race.postPosition ? (
                        <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md font-medium text-xs">
                          Cổng {race.postPosition}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Chưa xác định</span>
                      )}
                    </td>

                    {/* Trạng thái Race */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getRaceStatusBadge(race.raceStatus)}
                    </td>

                    {/* Trạng thái Entry */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getEntryStatusBadge(race.entryStatus)}
                    </td>

                    {/* Trạng thái Pairing */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getPairingStatusBadge(race.pairingStatus)}
                    </td>

                    {/* Kiểm tra độc lập */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getIndependenceCheckBadge(race.independenceCheckStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

