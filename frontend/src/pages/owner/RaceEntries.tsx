import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RaceEntry } from '../../types/owner.types';
import { getMyRaceEntries, confirmRaceEntry, withdrawRaceEntry } from '../../services/ownerService';

// --- Status badge configs ---


const ENTRY_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  Pending:      { label: 'Chờ xác nhận', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  PendingConf:  { label: 'Chờ xác nhận', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  Confirmed:    { label: 'Đã xác nhận',  cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500'  },
  Cancelled:    { label: 'Đã hủy',       cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500'    },
  Disqualified: { label: 'Bị loại',      cls: 'bg-gray-100 text-gray-600 border-gray-200',      dot: 'bg-gray-400'   },
  Withdrawn:    { label: 'Đã rút',       cls: 'bg-gray-100 text-gray-600 border-gray-200',      dot: 'bg-gray-400'   },
};

const FEE_STATUS: Record<string, { label: string; cls: string }> = {
  Paid:             { label: 'Đã thanh toán', cls: 'text-green-600' },
  Unpaid:           { label: 'Chưa thanh toán', cls: 'text-red-600' },
  'Refund Pending': { label: 'Chờ hoàn tiền', cls: 'text-yellow-600' },
  Refunded:         { label: 'Đã hoàn tiền',  cls: 'text-blue-600' },
};

function EntryStatusBadge({ status }: { status: string }) {
  const normalizedKey = Object.keys(ENTRY_STATUS).find(k => k.toLowerCase() === status.toLowerCase()) || status;
  const cfg = ENTRY_STATUS[normalizedKey] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function FeeStatusText({ status }: { status: string }) {
  const cfg = FEE_STATUS[status] ?? { label: status, cls: 'text-gray-600' };
  return <span className={`text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// --- Filter options ---

const ENTRY_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái entry' },
  { value: 'Pending', label: 'Chờ xác nhận' },
  { value: 'Confirmed', label: 'Đã xác nhận' },
  { value: 'Cancelled', label: 'Đã hủy' },
  { value: 'Disqualified', label: 'Bị loại' },
  { value: 'Withdrawn', label: 'Đã rút' },
];

const FEE_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái phí' },
  { value: 'Unpaid', label: 'Chưa thanh toán' },
  { value: 'Paid', label: 'Đã thanh toán' },
  { value: 'Refund Pending', label: 'Chờ hoàn tiền' },
  { value: 'Refunded', label: 'Đã hoàn tiền' },
];

// --- Skeleton Row ---

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(9)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-gray-100 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// --- Main Component ---

export default function RaceEntries() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleConfirm = async (raceEntryId: number) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await confirmRaceEntry(raceEntryId);
      showToast('Đã xác nhận tham gia.', 'success');
      await fetchEntries();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Xác nhận tham gia thất bại.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawAction = async () => {
    if (withdrawingId === null || actionLoading) return;
    setActionLoading(true);
    try {
      const reason = withdrawReason.trim() || 'Owner withdrawn';
      await withdrawRaceEntry(withdrawingId, reason);
      showToast('Đã rút lui khỏi cuộc đua.', 'success');
      setWithdrawingId(null);
      setWithdrawReason('');
      await fetchEntries();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Rút lui thất bại.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState('');

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyRaceEntries(
        statusFilter || undefined,
        feeStatusFilter || undefined
      );
      setEntries(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách đăng ký.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, feeStatusFilter]);

  // Fetch lai khi filter thay doi
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Page header
  const PageHeader = (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Đăng ký cuộc đua</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quản lý các đăng ký tham gia cuộc đua</p>
      </div>
      {!loading && !error && (
        <span className="px-3 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full self-start">
          {entries.length} đăng ký
        </span>
      )}
    </div>
  );

  // Filters bar
  const FiltersBar = (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      >
        {ENTRY_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select
        value={feeStatusFilter}
        onChange={(e) => setFeeStatusFilter(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      >
        {FEE_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {(statusFilter || feeStatusFilter) && (
        <button
          onClick={() => { setStatusFilter(''); setFeeStatusFilter(''); }}
          className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Xóa bộ lọc
        </button>
      )}
    </div>
  );

  // Error state
  if (error) {
    return (
      <div>
        {PageHeader}
        {FiltersBar}
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-3xl mb-3">&#9888;&#65039;</p>
          <p className="text-sm font-semibold text-gray-700 mb-1">Không thể tải dữ liệu</p>
          <p className="text-xs text-gray-500 mb-4">{error}</p>
          <button
            onClick={fetchEntries}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div>
      {/* Toast alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 text-white ${
          toast.type === 'success' ? 'bg-emerald-700' : 'bg-red-700'
        }`}>
          <span className="w-2 h-2 rounded-full bg-white flex-shrink-0" />
          {toast.message}
        </div>
      )}

      {PageHeader}
      {FiltersBar}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Mã ĐK</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Giải đấu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Race #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Ngày đua</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Ngựa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Jockey</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Lệ phí</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">TT phí</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">TT entry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <p className="text-3xl mb-3">&#127943;</p>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Chưa có đăng ký cuộc đua nào</p>
                    <p className="text-xs text-gray-500 mb-4">
                      {statusFilter || feeStatusFilter
                        ? 'Không có kết quả với bộ lọc hiện tại.'
                        : 'Hãy đăng ký ngựa của bạn để tham gia các cuộc đua sắp tới.'}
                    </p>
                    {!statusFilter && !feeStatusFilter && (
                      <button
                        onClick={() => navigate('/owner/horses')}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        Xem danh sách ngựa
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.raceEntryId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      #{entry.raceEntryId}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 text-xs leading-snug max-w-[180px]">
                        {entry.race.tournamentName}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-semibold text-xs">
                      #{entry.race.raceNumber}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDateTime(entry.race.scheduledTime)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700">
                      {entry.horse.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {entry.jockey ? entry.jockey.fullName : (
                        <span className="text-gray-400 italic">Chưa có</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-700 whitespace-nowrap">
                      {formatCurrency(entry.entryFeeAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <FeeStatusText status={entry.entryFeeStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <EntryStatusBadge status={entry.status} />
                        {(entry.status.toLowerCase() === 'pending' || entry.status.toLowerCase() === 'pendingconf') && (
                          <button
                            onClick={() => handleConfirm(entry.raceEntryId)}
                            disabled={actionLoading}
                            className="px-2 py-1 text-[10px] font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 rounded transition-colors whitespace-nowrap"
                          >
                            Xác nhận tham gia
                          </button>
                        )}
                        {(entry.status.toLowerCase() === 'pending' || entry.status.toLowerCase() === 'pendingconf' || entry.status.toLowerCase() === 'confirmed') && (
                          <button
                            onClick={() => setWithdrawingId(entry.raceEntryId)}
                            disabled={actionLoading}
                            className="px-2 py-1 text-[10px] font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded transition-colors whitespace-nowrap"
                          >
                            Rút lui
                          </button>
                        )}
                        {(entry.status.toLowerCase() === 'cancelled' || entry.status.toLowerCase() === 'withdrawn') && (
                          <span className="text-[10px] text-gray-400 italic">Đã hủy</span>
                        )}
                        {entry.status.toLowerCase() === 'disqualified' && (
                          <span className="text-[10px] text-gray-400 italic">Bị loại</span>
                        )}
                        {entry.status.toLowerCase() === 'rejected' && (
                          <span className="text-[10px] text-gray-400 italic">Bị từ chối</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdrawal Confirmation Modal */}
      {withdrawingId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Xác nhận rút lui</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                Bạn chắc chắn muốn rút lui khỏi cuộc đua này? Hành động này không thể hoàn tác.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Lý do rút lui (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Mặc định: Owner withdrawn"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white transition-colors"
                />
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-700 font-semibold">Phí tham gia sẽ không được hoàn lại.</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end rounded-b-xl">
              <button
                onClick={() => {
                  setWithdrawingId(null);
                  setWithdrawReason('');
                }}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleWithdrawAction}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:bg-red-400"
              >
                {actionLoading ? 'Đang xử lý...' : 'Xác nhận rút lui'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}