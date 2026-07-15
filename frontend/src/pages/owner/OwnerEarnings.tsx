import { useCallback, useEffect, useState } from 'react';
import {
  getOwnerEarnings,
  getRacePayouts,
} from '../../services/ownerService';
import type {
  OwnerEarnings,
  OwnerPayout,
  RacePayoutSummary,
} from '../../types/owner.types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : '—';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const isForbidden = (error: unknown) => {
  const message = errorMessage(error, '').toLowerCase();
  return message.includes('403') || message.includes('forbidden') || message.includes('không có quyền');
};

const StatusBadge = ({ status }: { status: string }) => {
  const normalized = status.toLowerCase();
  const styles = normalized === 'paid'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : normalized === 'unpaid'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${styles}`}>{status}</span>;
};

const PayoutTable = ({ payouts, emptyText }: { payouts: OwnerPayout[]; emptyText: string }) => {
  if (payouts.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-3">Ngựa</th>
            <th className="px-5 py-3">Thứ hạng</th>
            <th className="px-5 py-3">Tiền thưởng</th>
            <th className="px-5 py-3">Trạng thái</th>
            <th className="px-5 py-3">Ngày thanh toán</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payouts.map((payout) => (
            <tr key={payout.pursePayoutId}>
              <td className="px-5 py-4 font-semibold text-slate-900">{payout.horseName}</td>
              <td className="px-5 py-4 text-slate-700">{payout.finishPosition}</td>
              <td className="px-5 py-4 font-bold text-slate-900">{formatCurrency(payout.calculatedAmount)}</td>
              <td className="px-5 py-4"><StatusBadge status={payout.payoutStatus} /></td>
              <td className="px-5 py-4 text-slate-600">{formatDate(payout.paidAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function OwnerEarningsPage() {
  const [earnings, setEarnings] = useState<OwnerEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raceId, setRaceId] = useState('');
  const [racePayout, setRacePayout] = useState<RacePayoutSummary | null>(null);
  const [raceLoading, setRaceLoading] = useState(false);
  const [raceError, setRaceError] = useState<string | null>(null);

  const loadEarnings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEarnings(await getOwnerEarnings());
    } catch (loadError) {
      setError(errorMessage(loadError, 'Không tải được thông tin thu nhập.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  const loadRacePayout = async () => {
    const normalizedRaceId = Number(raceId);
    if (!Number.isInteger(normalizedRaceId) || normalizedRaceId <= 0) {
      setRaceError('Vui lòng nhập mã cuộc đua hợp lệ.');
      return;
    }
    setRaceLoading(true);
    setRaceError(null);
    setRacePayout(null);
    try {
      setRacePayout(await getRacePayouts(normalizedRaceId));
    } catch (loadError) {
      setRaceError(isForbidden(loadError)
        ? 'Bạn không có quyền xem chi tiết tiền thưởng của cuộc đua này.'
        : errorMessage(loadError, 'Không tải được chi tiết tiền thưởng của cuộc đua.'));
    } finally {
      setRaceLoading(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Đang tải thông tin thu nhập...</div>;
  }

  if (error || !earnings) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-700">{error || 'Không tải được thông tin thu nhập.'}</p>
        <button type="button" onClick={() => void loadEarnings()} className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200">
          Thử lại
        </button>
      </div>
    );
  }

  const cards = [
    ['Tổng tiền thưởng', earnings.totalEarnings],
    ['Đã thanh toán', earnings.paidAmount],
    ['Chưa thanh toán', earnings.unpaidAmount],
    ['Số khoản thưởng', earnings.payoutCount],
  ] as const;

  return (
    <div className="space-y-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Owner earnings</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Thu nhập</h1>
        <p className="mt-2 text-sm text-slate-500">Theo dõi tiền thưởng từ các cuộc đua của bạn.</p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value], index) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {index === 3 ? value : formatCurrency(value)}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg font-black text-slate-950">Chi tiết tiền thưởng</h2>
        </div>
        <PayoutTable payouts={earnings.payouts ?? []} emptyText="Bạn chưa có khoản thưởng nào." />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-black text-slate-950">Chi tiết tiền thưởng theo cuộc đua</h2>
        <p className="mt-1 text-sm text-slate-500">Nhập mã cuộc đua khi bạn cần xem bảng phân bổ chi tiết.</p>
        <div className="mt-4 flex max-w-md gap-3">
          <input type="number" min="1" value={raceId} onChange={(event) => setRaceId(event.target.value)} placeholder="Mã cuộc đua" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500" />
          <button type="button" disabled={raceLoading} onClick={() => void loadRacePayout()} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {raceLoading ? 'Đang tải...' : 'Xem chi tiết'}
          </button>
        </div>
        {raceError && <p className="mt-3 text-sm text-amber-700">{raceError}</p>}
        {racePayout && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid gap-4 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <div><p className="text-xs text-slate-500">Giải đấu</p><p className="mt-1 font-bold">{racePayout.tournamentName}</p></div>
              <div><p className="text-xs text-slate-500">Vòng đấu</p><p className="mt-1 font-bold">{racePayout.roundName}</p></div>
              <div><p className="text-xs text-slate-500">Race number</p><p className="mt-1 font-bold">{racePayout.raceNumber}</p></div>
              <div><p className="text-xs text-slate-500">Trạng thái race</p><p className="mt-1 font-bold">{racePayout.raceStatus}</p></div>
              <div><p className="text-xs text-slate-500">Tổng quỹ thưởng</p><p className="mt-1 font-bold">{formatCurrency(racePayout.purseAmount)}</p></div>
              <div><p className="text-xs text-slate-500">Tổng đã phân bổ</p><p className="mt-1 font-bold">{formatCurrency(racePayout.totalAllocated)}</p></div>
              <div><p className="text-xs text-slate-500">Phần còn lại</p><p className="mt-1 font-bold">{formatCurrency(racePayout.remainderAmount)}</p></div>
            </div>
            <PayoutTable payouts={racePayout.payouts ?? []} emptyText="Cuộc đua chưa có khoản thưởng nào." />
          </div>
        )}
      </section>
    </div>
  );
}
