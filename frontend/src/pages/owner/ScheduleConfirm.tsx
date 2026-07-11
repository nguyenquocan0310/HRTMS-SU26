import { useState } from 'react';

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

const STATUS_CFG: Record<
  RaceEntry['status'],
  { cls: string; dot: string }
> = {
  'Chờ xác nhận': { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  'Đã xác nhận':  { cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500'  },
  'Đã rút lui':   { cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500'    },
};

function StatusBadge({ status }: { status: RaceEntry['status'] }) {
  const cfg = STATUS_CFG[status] ?? { cls: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {status}
    </span>
  );
}

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
    <div>
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Xác nhận lịch thi đấu</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Xác nhận tham gia trước hạn hoặc rút lui khi cần thiết.
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngựa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Giải đấu</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày đua</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cự ly</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phí</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Hạn xác nhận</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.entryID} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800">{entry.horseName}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.tournament}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{entry.raceDate}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.distance}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium text-xs">
                    {entry.fee.toLocaleString('vi-VN')}đ
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{entry.confirmDeadline}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {entry.status === 'Chờ xác nhận' && (
                        <button
                          onClick={() => handleConfirm(entry.entryID)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Xác nhận tham gia
                        </button>
                      )}
                      {entry.status !== 'Đã rút lui' && (
                        <button
                          onClick={() => handleWithdrawRequest(entry.entryID)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                          Rút lui
                        </button>
                      )}
                      {entry.status === 'Đã rút lui' && (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info note */}
      <p className="mt-3 text-xs text-gray-400">
        Phí tham gia sẽ không được hoàn lại sau khi rút lui. Vui lòng cân nhắc kỹ trước khi thực hiện.
      </p>

      {/* Withdrawal Confirm Dialog */}
      {withdrawTarget && withdrawEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">Xác nhận rút lui</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
                <p className="font-semibold text-gray-800">{withdrawEntry.horseName}</p>
                <p className="text-gray-600 text-xs mt-0.5">{withdrawEntry.tournament}</p>
                <p className="text-gray-500 text-xs">{withdrawEntry.raceDate}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-700 font-semibold">
                  Phí tham gia ({withdrawEntry.fee.toLocaleString('vi-VN')}đ) sẽ không được hoàn lại.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 rounded-b-xl">
              <button
                onClick={handleWithdrawCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleWithdrawConfirm}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
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
