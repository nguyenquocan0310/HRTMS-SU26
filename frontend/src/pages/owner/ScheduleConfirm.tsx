import React, { useState } from 'react';

interface RaceEntry {
  entryID: string;
  horseName: string;
  tournament: string;
  raceDate: string;
  distance: string;
  fee: number;
  confirmDeadline: string;
  status: 'Chờ xác nhận' | 'Đã xác nhận' | 'Đã rút lui';
}

const mockEntries: RaceEntry[] = [
  {
    entryID: 'E001',
    horseName: 'Thunder Storm',
    tournament: 'Giải Mùa Hè 2026',
    raceDate: '20/06/2026 08:00',
    distance: '1400m',
    fee: 500000,
    confirmDeadline: '19/06/2026 23:59',
    status: 'Chờ xác nhận',
  },
  {
    entryID: 'E002',
    horseName: 'Golden Arrow',
    tournament: 'Giải Vô Địch 2026',
    raceDate: '22/06/2026 14:00',
    distance: '1600m',
    fee: 500000,
    confirmDeadline: '21/06/2026 23:59',
    status: 'Đã xác nhận',
  },
];

const getStatusBadge = (status: RaceEntry['status']) => {
  switch (status) {
    case 'Chờ xác nhận':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
          ⏳ Chờ xác nhận
        </span>
      );
    case 'Đã xác nhận':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
          ✅ Đã xác nhận
        </span>
      );
    case 'Đã rút lui':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
          ❌ Đã rút lui
        </span>
      );
  }
};

export default function ScheduleConfirm() {
  const [entries, setEntries] = useState<RaceEntry[]>(mockEntries);
  const [withdrawTarget, setWithdrawTarget] = useState<string | null>(null);

  const handleConfirm = (entryID: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.entryID === entryID ? { ...e, status: 'Đã xác nhận' } : e
      )
    );
  };

  const handleWithdrawRequest = (entryID: string) => {
    setWithdrawTarget(entryID);
  };

  const handleWithdrawConfirm = () => {
    if (!withdrawTarget) return;
    setEntries((prev) =>
      prev.map((e) =>
        e.entryID === withdrawTarget ? { ...e, status: 'Đã rút lui' } : e
      )
    );
    setWithdrawTarget(null);
  };

  const handleWithdrawCancel = () => {
    setWithdrawTarget(null);
  };

  const withdrawEntry = entries.find((e) => e.entryID === withdrawTarget);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Tiêu đề trang */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            Xác nhận lịch thi đấu & Rút lui
          </h1>
          <p className="text-gray-500 text-sm">
            Quản lý các đăng ký tham gia cuộc đua của ngựa. Xác nhận tham gia trước hạn hoặc rút lui khi cần thiết.
          </p>
        </div>

        {/* Bảng danh sách */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700">Tên ngựa</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700">Giải đấu</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700">Ngày đua</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700">Cự ly</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700">Phí tham gia</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700">Hạn xác nhận</th>
                  <th className="px-5 py-4 text-left font-semibold text-gray-700">Trạng thái</th>
                  <th className="px-5 py-4 text-center font-semibold text-gray-700">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.entryID} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-gray-800">
                      🐎 {entry.horseName}
                    </td>
                    <td className="px-5 py-4 text-gray-700">{entry.tournament}</td>
                    <td className="px-5 py-4 text-gray-700">{entry.raceDate}</td>
                    <td className="px-5 py-4 text-gray-700">{entry.distance}</td>
                    <td className="px-5 py-4 text-gray-700 font-medium">
                      {entry.fee.toLocaleString('vi-VN')}đ
                    </td>
                    <td className="px-5 py-4 text-gray-700">{entry.confirmDeadline}</td>
                    <td className="px-5 py-4">{getStatusBadge(entry.status)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {entry.status === 'Chờ xác nhận' && (
                          <button
                            onClick={() => handleConfirm(entry.entryID)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                          >
                            ✓ Xác nhận tham gia
                          </button>
                        )}
                        {entry.status !== 'Đã rút lui' && (
                          <button
                            onClick={() => handleWithdrawRequest(entry.entryID)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                          >
                            ✕ Rút lui
                          </button>
                        )}
                        {entry.status === 'Đã rút lui' && (
                          <span className="text-gray-400 text-xs italic">Đã rút lui</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chú thích */}
        <div className="mt-4 flex items-start gap-2 text-xs text-gray-500">
          <span>ℹ️</span>
          <span>Phí tham gia sẽ không được hoàn lại sau khi rút lui. Vui lòng cân nhắc kỹ trước khi thực hiện.</span>
        </div>
      </div>

      {/* Dialog xác nhận rút lui */}
      {withdrawTarget && withdrawEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-fade-in">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">⚠️</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Xác nhận rút lui</h2>
              <p className="text-gray-600 text-sm">
                Bạn có chắc muốn rút lui khỏi cuộc đua?
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 text-sm">
              <p className="font-semibold text-orange-800 mb-1">🐎 {withdrawEntry.horseName}</p>
              <p className="text-orange-700">Giải đấu: {withdrawEntry.tournament}</p>
              <p className="text-orange-700">Ngày đua: {withdrawEntry.raceDate}</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-red-700 text-sm font-semibold text-center">
                🚫 Phí tham gia ({withdrawEntry.fee.toLocaleString('vi-VN')}đ) sẽ không được hoàn lại.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleWithdrawCancel}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleWithdrawConfirm}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Xác nhận rút lui
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
