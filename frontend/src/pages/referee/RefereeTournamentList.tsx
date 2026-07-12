import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMyTournamentParticipations,
  getTournaments,
  registerForTournament,
  type ParticipationResponse,
  type TournamentResponse,
} from '../../services/tournamentService';

const STATUS_STYLE: Record<string, string> = {
  Pending: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  ManualReview: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  AutoEligible: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Rejected: 'border-red-200 bg-red-50 text-red-700',
  AutoRejected: 'border-red-200 bg-red-50 text-red-700',
};

const TOURNAMENT_STATUS_STYLE: Record<string, string> = {
  'Open Registration': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Upcoming: 'bg-blue-50 text-blue-700 border-blue-100',
  Completed: 'bg-gray-100 text-gray-600 border-gray-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-100',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    Pending: 'Đang chờ duyệt',
    ManualReview: 'Đang chờ duyệt',
    Approved: 'Đã được duyệt',
    AutoEligible: 'Đã được duyệt',
    Rejected: 'Bị từ chối',
    AutoRejected: 'Bị từ chối',
  };
  return labels[status] ?? status;
}

function TournamentCard({
  tournament,
  participation,
  onRegister,
  registeringId,
}: {
  tournament: TournamentResponse;
  participation: ParticipationResponse | null;
  onRegister: (tournamentId: number) => Promise<void>;
  registeringId: number | null;
}) {
  const isRegistered = participation != null;
  const statusCls = participation
    ? STATUS_STYLE[participation.status] ?? 'border-gray-200 bg-gray-50 text-gray-700'
    : '';
  const tournamentStatusCls =
    TOURNAMENT_STATUS_STYLE[tournament.status] ?? 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-gray-900">{tournament.name}</h3>
          <p className="mt-1 text-xs text-gray-400">
            {formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${tournamentStatusCls}`}>
          {tournament.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Giống ngựa</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-gray-800">{tournament.allowedBreed}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Cự ly</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-800">{tournament.raceDistance} m</p>
        </div>
        <div className="col-span-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Giải thưởng</p>
          <p className="mt-0.5 text-xs font-semibold text-emerald-700">{formatCurrency(tournament.purseAmount)}</p>
        </div>
      </div>

      {participation && (
        <div className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${statusCls}`}>
          {statusLabel(participation.status)}
          {participation.rejectionReason ? (
            <p className="mt-1 font-medium normal-case">{participation.rejectionReason}</p>
          ) : null}
        </div>
      )}

      <button
        onClick={() => onRegister(tournament.tournamentId)}
        disabled={isRegistered || registeringId === tournament.tournamentId}
        className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
      >
        {registeringId === tournament.tournamentId
          ? 'Đang đăng ký...'
          : isRegistered
            ? 'Đã đăng ký'
            : 'Đăng ký tham gia'}
      </button>
    </div>
  );
}

export default function RefereeTournamentList() {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [participations, setParticipations] = useState<Record<number, ParticipationResponse>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [registeringId, setRegisteringId] = useState<number | null>(null);

  const loadParticipations = useCallback(async () => {
    const list = await getMyTournamentParticipations();
    const map: Record<number, ParticipationResponse> = {};
    for (const item of list) map[item.tournamentId] = item;
    setParticipations(map);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [tournamentList] = await Promise.all([getTournaments(), loadParticipations()]);
      setTournaments(tournamentList.filter((item) => item.status === 'Open Registration'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách giải.');
    } finally {
      setLoading(false);
    }
  }, [loadParticipations]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => tournaments.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    [search, tournaments]
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const handleRegister = async (tournamentId: number) => {
    try {
      setRegisteringId(tournamentId);
      await registerForTournament(tournamentId);
      await loadParticipations();
      showToast('Đăng ký thành công, đang chờ Admin duyệt.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Đăng ký thất bại.');
    } finally {
      setRegisteringId(null);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đăng ký giải đấu</h1>
          <p className="mt-1 text-sm text-gray-500">
            Referee đăng ký giải để được Admin duyệt roster trước khi phân công vào race.
          </p>
        </div>
        {!loading && (
          <span className="self-start rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            {filtered.length} giải mở đăng ký
          </span>
        )}
      </div>

      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Tìm kiếm giải đấu theo tên..."
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:max-w-sm"
      />

      {error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-lg border border-gray-100 bg-white" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-sm font-semibold text-gray-700">
            {search ? 'Không tìm thấy giải phù hợp' : 'Hiện tại không có giải nào đang mở đăng ký'}
          </p>
          <p className="mt-1 text-xs text-gray-400">Quay lại sau khi Admin mở đăng ký cho giải mới.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tournament) => (
            <TournamentCard
              key={tournament.tournamentId}
              tournament={tournament}
              participation={participations[tournament.tournamentId] ?? null}
              onRegister={handleRegister}
              registeringId={registeringId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
