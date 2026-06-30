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

// ─── Status badge configs ────────────────────────────────────────────────────

const ENTRY_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  PendingConf:  { label: 'Chờ xác nhận', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500'  },
  Confirmed:    { label: 'Đã xác nhận',  cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500'   },
  Cancelled:    { label: 'Đã hủy',        cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500'     },
  Disqualified: { label: 'Bị loại',       cls: 'bg-gray-100 text-gray-600 border-gray-200',      dot: 'bg-gray-400'    },
};

const FEE_STATUS: Record<string, { label: string; cls: string }> = {
  Paid:           { label: 'Đã thanh toán', cls: 'text-green-600' },
  Unpaid:         { label: 'Chưa thanh toán', cls: 'text-red-600' },
  'Refund Pending': { label: 'Chờ hoàn tiền', cls: 'text-yellow-600' },
  Refunded:       { label: 'Đã hoàn tiền',  cls: 'text-blue-600' },
};

function EntryStatusBadge({ status }: { status: RaceEntry['status'] }) {
  const cfg = ENTRY_STATUS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function FeeStatusText({ status }: { status: RaceEntry['entryFeeStatus'] }) {
  const cfg = FEE_STATUS[status] ?? { label: status, cls: 'text-gray-600' };
  return <span className={`text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

// ─── Main Component ────────────────────────────────────────────────────────────

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
      <div>
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Đăng ký cuộc đua</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý các đăng ký tham gia cuộc đua</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mb-3" />
          <p className="text-sm text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div>
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Đăng ký cuộc đua</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý các đăng ký tham gia cuộc đua</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-3xl mb-3">🏇</p>
          <p className="text-sm font-semibold text-gray-700 mb-1">Chưa có đăng ký cuộc đua nào</p>
          <p className="text-xs text-gray-500 mb-4">
            Hãy đăng ký ngựa của bạn để tham gia các cuộc đua sắp tới.
          </p>
          <button
            onClick={() => navigate('/owner/horses')}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Xem danh sách ngựa
          </button>
        </div>
      </div>
    );
  }

  // List state
  return (
    <div>
      {/* Page header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Đăng ký cuộc đua</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý các đăng ký tham gia cuộc đua</p>
        </div>
        <span className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
          {entries.length} đăng ký
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Cuộc đua</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Ngựa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phí</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày đăng ký</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.entryID} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{entry.raceID}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.horseID}</td>
                  <td className="px-4 py-3">
                    <EntryStatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3">
                    <FeeStatusText status={entry.entryFeeStatus} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(entry.registeredAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {entry.status === 'PendingConf' && (
                        <>
                          <button
                            onClick={() => handleConfirmEntry(entry.entryID)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            Xác nhận
                          </button>
                          <button
                            onClick={() => setWithdrawingID(entry.entryID)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                          >
                            Rút lui
                          </button>
                        </>
                      )}

                      {entry.status === 'Confirmed' && (
                        <button
                          onClick={() => setWithdrawingID(entry.entryID)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                          Rút lui
                        </button>
                      )}

                      {entry.status === 'Cancelled' && (
                        <span className="text-xs text-gray-400 italic">Đã hủy</span>
                      )}

                      {entry.status === 'Disqualified' && (
                        <span className="text-xs text-gray-400 italic">Bị loại</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdrawal Confirmation Modal */}
      {withdrawingID && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Xác nhận rút lui</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-4">
                Bạn chắc chắn muốn rút lui khỏi cuộc đua này? Hành động này không thể hoàn tác.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-700 font-semibold">Phí tham gia sẽ không được hoàn lại.</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end rounded-b-xl">
              <button
                onClick={() => setWithdrawingID(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => handleWithdraw(withdrawingID)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
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
