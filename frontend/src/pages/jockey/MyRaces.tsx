import React, { useState, useEffect } from 'react';
import type { JockeyRaceEntry } from '../../types/jockey.types';
import RaceStatusBadge from '../../components/jockey/RaceStatusBadge';

// Mock data
const mockRaceEntries: JockeyRaceEntry[] = [
  {
    entryID: 'entry-001',
    raceID: 'race-001',
    horseName: 'Thunder Storm',
    ownerName: 'Nguyễn Văn A',
    scheduledTime: '2024-06-20T14:00:00',
    distanceM: 2000,
    purse: 50000000,
    gateNumber: 3,
    status: 'Confirmed',
  },
  {
    entryID: 'entry-002',
    raceID: 'race-002',
    horseName: 'Golden Arrow',
    ownerName: 'Trần Thị B',
    scheduledTime: '2024-06-21T15:30:00',
    distanceM: 2400,
    purse: 75000000,
    gateNumber: 1,
    status: 'PendingConf',
  },
  {
    entryID: 'entry-003',
    raceID: 'race-003',
    horseName: 'Dark Knight',
    ownerName: 'Lê Văn C',
    scheduledTime: '2024-06-22T16:00:00',
    distanceM: 1800,
    purse: 40000000,
    gateNumber: undefined,
    status: 'Cancelled',
  },
];

export default function MyRaces() {
  const [races, setRaces] = useState<JockeyRaceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setRaces(mockRaceEntries);
      setLoading(false);
    }, 500);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (races.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🏁</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Chưa có cuộc đua nào
          </h2>
          <p className="text-gray-600">
            Hãy chấp nhận lời mời để tham gia các cuộc đua sắp tới.
          </p>
        </div>
      </div>
    );
  }

  // List state
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Cuộc đua của tôi
          </h1>
          <p className="text-gray-600">
            Xem danh sách các cuộc đua sắp tới
          </p>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Table Header */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Số thứ tự
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Tên ngựa
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Chủ ngựa
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Giờ đua
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Cự ly (m)
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Tiền thưởng
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Công xuất phát
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Trạng thái
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-200">
                {races.map((race, index) => (
                  <tr key={race.entryID} className="hover:bg-gray-50 transition-colors">
                    {/* Số thứ tự */}
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                      {index + 1}
                    </td>

                    {/* Tên ngựa */}
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                      {race.horseName}
                    </td>

                    {/* Chủ ngựa */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {race.ownerName}
                    </td>

                    {/* Giờ đua */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {new Date(race.scheduledTime).toLocaleString('vi-VN')}
                    </td>

                    {/* Cự ly */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {race.distanceM.toLocaleString('vi-VN')}
                    </td>

                    {/* Tiền thưởng */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {race.purse.toLocaleString('vi-VN')} ₫
                    </td>

                    {/* Công xuất phát */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {race.gateNumber ? (
                        <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                          #{race.gateNumber}
                        </span>
                      ) : (
                        <span className="text-gray-500">Chưa xác định</span>
                      )}
                    </td>

                    {/* Trạng thái */}
                    <td className="px-6 py-4">
                      <RaceStatusBadge status={race.status} />
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
