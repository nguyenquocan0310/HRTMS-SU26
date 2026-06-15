import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RaceEntry } from '../../types/owner.types';

// Mock data
const mockRaceEntries: RaceEntry[] = [
  {
    entryID: 'entry-001',
    raceID: 'race-001',
    horseID: '1',
    jockeyID: 'jockey-001',
    status: 'PendingConf',
    entryFeeStatus: 'Paid',
    registeredAt: new Date('2024-06-10'),
    confirmedAt: undefined,
  },
  {
    entryID: 'entry-002',
    raceID: 'race-002',
    horseID: '2',
    jockeyID: 'jockey-002',
    status: 'Confirmed',
    entryFeeStatus: 'Paid',
    registeredAt: new Date('2024-06-05'),
    confirmedAt: new Date('2024-06-08'),
  },
];

export default function RaceEntries() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingID, setWithdrawingID] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setEntries(mockRaceEntries);
      setLoading(false);
    }, 500);
  }, []);

  const getStatusColor = (status: RaceEntry['status']): string => {
    switch (status) {
      case 'PendingConf':
        return 'bg-yellow-100 text-yellow-800';
      case 'Confirmed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      case 'Disqualified':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFeeStatusColor = (status: RaceEntry['entryFeeStatus']): string => {
    switch (status) {
      case 'Paid':
        return 'text-green-600';
      case 'Unpaid':
        return 'text-red-600';
      case 'Refund Pending':
        return 'text-yellow-600';
      case 'Refunded':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleConfirmEntry = (entryID: string) => {
    // Mock confirmation
    setEntries((prev) =>
      prev.map((entry) =>
        entry.entryID === entryID
          ? { ...entry, status: 'Confirmed' as const, confirmedAt: new Date() }
          : entry
      )
    );
  };

  const handleWithdraw = (entryID: string) => {
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn rút lui khỏi cuộc đua này không? Hành động này không thể hoàn tác.'
    );

    if (confirmed) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.entryID === entryID
            ? { ...entry, status: 'Cancelled' as const, cancelReason: 'Chủ ngựa rút lui' }
            : entry
        )
      );
      setWithdrawingID(null);
    }
  };

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
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🏇</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Chưa có đăng ký cuộc đua nào
          </h2>
          <p className="text-gray-600 mb-6">
            Hãy đăng ký ngựa của bạn để tham gia các cuộc đua sắp tới.
          </p>
          <button
            onClick={() => navigate('/owner/horses')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Xem danh sách ngựa
          </button>
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
            Đăng ký cuộc đua
          </h1>
          <p className="text-gray-600">
            Quản lý các đăng ký tham gia cuộc đua của ngựa của bạn
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
                    ID Cuộc đua
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    ID Ngựa
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Trạng thái
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Trạng thái phí
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Ngày đăng ký
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                    Hành động
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.entryID} className="hover:bg-gray-50 transition-colors">
                    {/* Race ID */}
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                      {entry.raceID}
                    </td>

                    {/* Horse ID */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {entry.horseID}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          entry.status
                        )}`}
                      >
                        {entry.status === 'PendingConf' ? 'Chờ xác nhận' : entry.status}
                      </span>
                    </td>

                    {/* Fee Status */}
                    <td className={`px-6 py-4 text-sm font-medium ${getFeeStatusColor(entry.entryFeeStatus)}`}>
                      {entry.entryFeeStatus}
                    </td>

                    {/* Registered Date */}
                    <td className="px-6 py-4 text-sm text-gray-800">
                      {new Date(entry.registeredAt).toLocaleDateString('vi-VN')}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {entry.status === 'PendingConf' && (
                          <>
                            <button
                              onClick={() => handleConfirmEntry(entry.entryID)}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md transition-colors"
                            >
                              Xác nhận tham gia
                            </button>
                            <button
                              onClick={() => setWithdrawingID(entry.entryID)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
                            >
                              Rút lui
                            </button>

                            {/* Withdrawal Confirmation Modal */}
                            {withdrawingID === entry.entryID && (
                              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
                                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                                    Xác nhận rút lui
                                  </h3>
                                  <p className="text-gray-600 mb-6">
                                    Bạn chắc chắn muốn rút lui khỏi cuộc đua này? Hành động này không thể hoàn tác.
                                  </p>
                                  <div className="flex gap-3 justify-end">
                                    <button
                                      onClick={() => setWithdrawingID(null)}
                                      className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                      Hủy
                                    </button>
                                    <button
                                      onClick={() => handleWithdraw(entry.entryID)}
                                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                                    >
                                      Rút lui
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {entry.status === 'Confirmed' && (
                          <button
                            onClick={() => setWithdrawingID(entry.entryID)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
                          >
                            Rút lui
                          </button>
                        )}

                        {entry.status === 'Confirmed' && withdrawingID === entry.entryID && (
                          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
                              <h3 className="text-lg font-bold text-gray-800 mb-4">
                                Xác nhận rút lui
                              </h3>
                              <p className="text-gray-600 mb-6">
                                Bạn chắc chắn muốn rút lui khỏi cuộc đua đã xác nhận này? Hành động này không thể hoàn tác.
                              </p>
                              <div className="flex gap-3 justify-end">
                                <button
                                  onClick={() => setWithdrawingID(null)}
                                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => handleWithdraw(entry.entryID)}
                                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                                >
                                  Rút lui
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {entry.status === 'Cancelled' && (
                          <span className="px-3 py-1 text-xs text-gray-600">
                            Đã hủy
                          </span>
                        )}

                        {entry.status === 'Disqualified' && (
                          <span className="px-3 py-1 text-xs text-gray-600">
                            Bị loại
                          </span>
                        )}
                      </div>
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
