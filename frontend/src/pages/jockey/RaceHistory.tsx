import { useState, useEffect } from 'react';
import type { JockeyRaceResult } from '../../types/jockey.types';

// Dữ liệu mẫu
const mockRaceResults: JockeyRaceResult[] = [
  {
    resultID: 'result-001',
    raceID: 'race-001',
    horseName: 'Thunder Storm',
    finishPosition: 1,
    timeSeconds: 125.45,
    prizeAmount: 50000000,
    pointsEarned: 100,
    isDisqualified: false,
    raceDate: '2024-06-10',
  },
  {
    resultID: 'result-002',
    raceID: 'race-002',
    horseName: 'Golden Arrow',
    finishPosition: 2,
    timeSeconds: 126.80,
    prizeAmount: 30000000,
    pointsEarned: 50,
    isDisqualified: false,
    raceDate: '2024-06-08',
  },
  {
    resultID: 'result-003',
    raceID: 'race-003',
    horseName: 'Dark Knight',
    finishPosition: 3,
    timeSeconds: 128.12,
    prizeAmount: 20000000,
    pointsEarned: 30,
    isDisqualified: false,
    raceDate: '2024-06-05',
  },
  {
    resultID: 'result-004',
    raceID: 'race-004',
    horseName: 'Midnight Racer',
    finishPosition: 5,
    timeSeconds: 130.20,
    prizeAmount: 0,
    pointsEarned: 10,
    isDisqualified: false,
    raceDate: '2024-06-02',
  },
];

export default function RaceHistory() {
  const [results, setResults] = useState<JockeyRaceResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mô phỏng tải dữ liệu
    setTimeout(() => {
      setResults(mockRaceResults);
      setLoading(false);
    }, 500);
  }, []);

  // Tính toán thống kê tổng hợp
  const totalRaces = results.length;
  const winCount = results.filter((r) => r.finishPosition === 1).length;
  const totalPrize = results.reduce((sum, r) => sum + r.prizeAmount, 0);
  const winRate =
    totalRaces > 0 ? ((winCount / totalRaces) * 100).toFixed(1) : '0';

  const getPositionBadgeColor = (position: number): string => {
    switch (position) {
      case 1:
        return 'bg-yellow-100 text-yellow-800 font-bold';
      case 2:
        return 'bg-gray-100 text-gray-800 font-bold';
      case 3:
        return 'bg-orange-100 text-orange-800 font-bold';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getPositionText = (position: number): string => {
    switch (position) {
      case 1:
        return 'Nhất';
      case 2:
        return 'Nhì';
      case 3:
        return 'Ba';
      default:
        return `Thứ ${position}`;
    }
  };

  // Trạng thái đang tải
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500 text-lg">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Trạng thái rỗng
  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Chưa có lịch sử thi đấu
          </h2>
          <p className="text-gray-500">
            Lịch sử thi đấu của bạn sẽ được hiển thị tại đây sau khi hoàn thành cuộc đua.
          </p>
        </div>
      </div>
    );
  }

  // Danh sách lịch sử
  return (
    <div className="space-y-6">
      <div>
        {/* Tiêu đề */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Lịch sử thi đấu
          </h1>
          <p className="text-gray-500">
            Xem các kết quả và thống kê thi đấu của bạn
          </p>
        </div>

        {/* Thẻ thống kê tổng hợp */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Tổng số trận */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-sm font-medium mb-2">
              Tổng số trận
            </p>
            <p className="text-3xl font-bold text-blue-600">{totalRaces}</p>
          </div>

          {/* Số lần thắng */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-sm font-medium mb-2">
              Số lần thắng
            </p>
            <p className="text-3xl font-bold text-yellow-600">{winCount}</p>
          </div>

          {/* Tổng tiền thưởng */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-sm font-medium mb-2">
              Tổng tiền thưởng
            </p>
            <p className="text-2xl font-bold text-green-600">
              {(totalPrize / 1000000).toFixed(0)}M ₫
            </p>
          </div>

          {/* Tỉ lệ thắng */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <p className="text-gray-500 text-sm font-medium mb-2">
              Tỉ lệ thắng
            </p>
            <p className="text-3xl font-bold text-purple-600">{winRate}%</p>
          </div>
        </div>

        {/* Bảng lịch sử */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* Tiêu đề bảng */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Ngày đua
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Tên ngựa
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Thứ hạng về đích
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Thời gian (s)
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Tiền thưởng
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Điểm tích lũy
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Trạng thái
                  </th>
                </tr>
              </thead>

              {/* Nội dung bảng */}
              <tbody className="divide-y divide-gray-200">
                {results.map((result) => (
                  <tr key={result.resultID} className="hover:bg-gray-50 transition-colors">
                    {/* Ngày đua */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {new Date(result.raceDate).toLocaleDateString('vi-VN')}
                    </td>

                    {/* Tên ngựa */}
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                      {result.horseName}
                    </td>

                    {/* Hạng về đích */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${getPositionBadgeColor(
                          result.finishPosition
                        )}`}
                      >
                        {getPositionText(result.finishPosition)}
                      </span>
                    </td>

                    {/* Thời gian */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {result.timeSeconds.toFixed(2)}s
                    </td>

                    {/* Tiền thưởng */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {result.prizeAmount > 0 ? (
                        <span className="font-medium text-green-600">
                          {result.prizeAmount.toLocaleString('vi-VN')} ₫
                        </span>
                      ) : (
                        <span className="text-gray-500">0 ₫</span>
                      )}
                    </td>

                    {/* Điểm tích lũy */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                        +{result.pointsEarned}
                      </span>
                    </td>

                    {/* Trạng thái */}
                    <td className="px-6 py-4 text-sm">
                      {result.isDisqualified ? (
                        <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium text-xs">
                          Bị loại (Vi phạm)
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium text-xs">
                          Hoàn thành
                        </span>
                      )}
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


