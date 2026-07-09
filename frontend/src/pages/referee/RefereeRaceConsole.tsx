import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  checkJockeyIndependence,
  confirmStartingList,
  getMyRefereeRaceAssignments,
  getRefereeRaceEntries,
  type ConfirmStartingListResult,
  type RefereeRaceAssignment,
  type RefereeRaceEntry,
  type StartingListEntry,
} from '../../services/refereeService';

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Chưa có lịch';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status: string | null | undefined) {
  const normalized = status || 'Chưa kiểm tra';
  const cls =
    normalized === 'Passed' || normalized === 'Clear' || normalized === 'Đạt'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : normalized === 'Warning' || normalized === 'Conflict' || normalized === 'Cảnh báo COI'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : normalized === 'Disqualified'
          ? 'border-red-100 bg-red-50 text-red-700'
          : 'border-gray-100 bg-gray-50 text-gray-500';

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {normalized}
    </span>
  );
}

function independenceLabel(entry: RefereeRaceEntry) {
  if (entry.hasIndependenceWarning) return 'Cảnh báo COI';
  if (entry.independenceCheckStatus) return entry.independenceCheckStatus;
  return 'Chưa kiểm tra';
}

function ResultTable({ title, items }: { title: string; items: StartingListEntry[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Post</th>
              <th className="px-4 py-3 font-semibold">Ngựa</th>
              <th className="px-4 py-3 font-semibold">Kỵ sĩ</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold">Lý do</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.raceEntryId}>
                <td className="px-4 py-3 font-mono text-xs font-bold text-gray-500">{item.postPosition ?? '-'}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">{item.horseName}</td>
                <td className="px-4 py-3 text-gray-700">{item.jockeyName}</td>
                <td className="px-4 py-3 text-gray-700">{item.ownerName}</td>
                <td className="px-4 py-3">{statusBadge(item.status)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{item.rejectionReason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RefereeRaceConsole() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const raceIdParam = searchParams.get('raceId');
  const raceId = raceIdParam ? Number(raceIdParam) : null;
  const hasValidRaceId = raceId != null && Number.isFinite(raceId);

  const [assignment, setAssignment] = useState<RefereeRaceAssignment | null>(null);
  const [entries, setEntries] = useState<RefereeRaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [startingListResult, setStartingListResult] = useState<ConfirmStartingListResult | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    if (!hasValidRaceId || raceId == null) {
      setError('Không tìm thấy raceId để mở Race Console.');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [assignments, entryList] = await Promise.all([
          getMyRefereeRaceAssignments().catch(() => []),
          getRefereeRaceEntries(raceId),
        ]);
        setAssignment(assignments.find((item) => item.raceId === raceId) ?? null);
        setEntries(entryList);
      } catch (err) {
        setEntries([]);
        setError(err instanceof Error ? err.message : 'Không tải được danh sách race entries.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [hasValidRaceId, raceId]);

  const checkedCount = useMemo(
    () => entries.filter((item) => item.independenceCheckStatus || item.hasIndependenceWarning).length,
    [entries]
  );

  const handleIndependenceCheck = async (entry: RefereeRaceEntry) => {
    const key = `check-${entry.raceEntryId}`;
    try {
      setSavingKey(key);
      const result = await checkJockeyIndependence(entry.raceEntryId);
      setEntries((prev) =>
        prev.map((item) =>
          item.raceEntryId === entry.raceEntryId
            ? {
                ...item,
                independenceCheckStatus: result.independenceCheckStatus,
                independenceViolationReason: result.violationReason,
                hasIndependenceWarning: result.hasWarning,
                raceEntryStatus: result.raceEntryStatus,
                status: result.raceEntryStatus ?? item.status,
              }
            : item
        )
      );
      showToast(result.message || 'Đã kiểm tra độc lập Jockey.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể kiểm tra độc lập.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleConfirmStartingList = async () => {
    if (!raceId) return;
    try {
      setSavingKey('starting-list');
      const result = await confirmStartingList(raceId);
      setStartingListResult(result);
      showToast(result.message || 'Đã xác nhận starting list.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xác nhận starting list.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-gray-900 px-4 py-3 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Race Console</h1>
          {assignment ? (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{assignment.tournamentName ?? 'Tournament'}</span>
                {' - '}
                {assignment.roundName ?? 'Round'}
                {' - '}
                <span className="font-mono font-bold text-blue-700">
                  Race #{assignment.raceNumber ?? assignment.raceId}
                </span>
              </p>
              <p className="text-xs text-gray-400">{formatDateTime(assignment.scheduledTime)}</p>
            </div>
          ) : hasValidRaceId ? (
            <p className="mt-1 text-xs text-amber-600">
              Không tìm thấy race này trong assignment của bạn, nhưng vẫn thử tải entries.
            </p>
          ) : (
            <p className="mt-1 text-xs text-red-600">Thiếu raceId.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
            Referee Pre-Race
          </span>
          <button
            onClick={handleConfirmStartingList}
            disabled={entries.length === 0 || savingKey === 'starting-list'}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
          >
            {savingKey === 'starting-list' ? 'Đang xác nhận...' : 'Xác nhận starting list'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Entries</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{entries.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Đã independence check</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{checkedCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cảnh báo COI</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {entries.filter((item) => item.hasIndependenceWarning).length}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Live Race, Violation, Protest và Race Report chưa có API backend trong Swagger module H/I, nên console này chỉ thao tác phần pre-race thật.
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Race entries</h2>
            <p className="mt-1 text-xs text-gray-500">Entries chỉ hiện sau khi Admin bốc thăm post position.</p>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Đang tải race entries...</div>
        ) : error ? (
          <div className="m-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-gray-700">Chưa có race entry nào trong race này.</p>
            <p className="mt-1 text-xs text-gray-400">Hãy kiểm tra race đã được bốc thăm post position chưa.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Post</th>
                  <th className="px-5 py-3 font-semibold">Ngựa / Kỵ sĩ</th>
                  <th className="px-5 py-3 font-semibold">Owner</th>
                  <th className="px-5 py-3 font-semibold">Entry status</th>
                  <th className="px-5 py-3 font-semibold">Doctor checks</th>
                  <th className="px-5 py-3 font-semibold">Independence</th>
                  <th className="px-5 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => {
                  const key = `check-${entry.raceEntryId}`;
                  return (
                    <tr key={entry.raceEntryId} className="hover:bg-gray-50/50">
                      <td className="px-5 py-4 font-mono text-xs font-bold text-gray-500">
                        {entry.postPosition ?? '-'}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{entry.horseName}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{entry.jockeyName}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-700">{entry.ownerName ?? '-'}</td>
                      <td className="px-5 py-4">{statusBadge(entry.raceEntryStatus ?? entry.status)}</td>
                      <td className="px-5 py-4">
                        <div className="space-y-1 text-xs text-gray-500">
                          <p>Danh tính: {entry.horseIdentityCheckStatus || 'Chưa kiểm tra'}</p>
                          <p>Khám: {entry.clinicalStatus || 'Chưa khám'}</p>
                          <p>Cân trước đua: {entry.preRaceJockeyWeight ?? 'Chưa cân'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          {statusBadge(independenceLabel(entry))}
                          {entry.independenceViolationReason && (
                            <p className="max-w-[240px] text-xs text-amber-700">{entry.independenceViolationReason}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleIndependenceCheck(entry)}
                          disabled={savingKey === key}
                          className="rounded-md bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingKey === key ? 'Đang kiểm tra...' : 'Kiểm tra độc lập'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {startingListResult && (
        <section className="space-y-4">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">{startingListResult.message || 'Đã xác nhận starting list.'}</p>
            <p className="mt-1 text-xs">
              Accepted: {startingListResult.confirmedEntriesCount} - Rejected:{' '}
              {startingListResult.rejectedEntriesCount}
            </p>
          </div>
          <ResultTable title="Entries được xác nhận vào starting list" items={startingListResult.confirmedEntries ?? []} />
          <ResultTable title="Entries bị loại khỏi starting list" items={startingListResult.rejectedEntries ?? []} />
        </section>
      )}
    </div>
  );
}
