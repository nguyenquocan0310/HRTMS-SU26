import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  checkJockeyIndependence,
  confirmStartingList,
  createRaceViolation,
  deleteRaceViolation,
  finishRace,
  getMyRefereeRaceAssignments,
  getRaceLiveStatus,
  getRaceViolations,
  getRefereeRaceEntries,
  getViolationCodes,
  startRace,
  updateRaceViolation,
  type ConfirmStartingListResult,
  type FinishRacePayload,
  type RaceLiveStatus,
  type RaceViolation,
  type RefereeRaceAssignment,
  type RefereeRaceEntry,
  type StartingListEntry,
  type ViolationCodeOption,
} from '../../services/refereeService';
import { getProtestsByRace, ruleProtest } from '../../services/protestService';
import type {
  Penalty,
  Protest,
  ProtestDecision,
  ProtestRulingPayload,
  UpdateViolationPayload,
} from '../../types/protest.types';
import JockeyCareerStatsModal from '../../components/jockey/JockeyCareerStatsModal';

const PENALTIES: Penalty[] = ['Disqualified', 'PlaceBehind', 'Warning', 'Scratch'];

interface ViolationFormState {
  raceEntryId: string;
  violationCode: string;
  penalty: Penalty | '';
  placeBehindEntryId: string;
  description: string;
}

const emptyViolationForm = (): ViolationFormState => ({
  raceEntryId: '',
  violationCode: '',
  penalty: '',
  placeBehindEntryId: '',
  description: '',
});

const emptyRulingForm = (): ProtestRulingPayload => ({
  decision: 'Rejected',
  penalty: null,
  placeBehindEntryId: null,
  notes: '',
});

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

function DoctorChecks({ entry }: { entry: RefereeRaceEntry }) {
  const hasDoctorData =
    entry.selfDeclaredWeight !== undefined ||
    entry.preRaceJockeyWeight !== undefined ||
    entry.horseIdentityCheckStatus !== undefined ||
    entry.clinicalStatus !== undefined ||
    entry.isEmergencyDisqualified !== undefined;

  if (!hasDoctorData) {
    return <p className="text-xs text-amber-700">Chưa có dữ liệu từ API</p>;
  }

  return (
    <div className="space-y-1 text-xs text-gray-500">
      <p>
        Danh tính:{' '}
        {entry.horseIdentityCheckStatus || '—'}
      </p>
      <p>Khám: {entry.clinicalStatus || '—'}</p>
      <p>
        Cân trước đua:{' '}
        {entry.preRaceJockeyWeight ?? '—'}
      </p>
      {entry.isEmergencyDisqualified && (
        <p className="font-semibold text-red-700">Đã loại khẩn cấp</p>
      )}
    </div>
  );
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
  const hasValidRaceId = raceId != null && Number.isInteger(raceId) && raceId > 0;

  const [assignment, setAssignment] = useState<RefereeRaceAssignment | null>(null);
  const [entries, setEntries] = useState<RefereeRaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [startingListResult, setStartingListResult] = useState<ConfirmStartingListResult | null>(null);
  const [liveStatus, setLiveStatus] = useState<RaceLiveStatus | null>(null);
  const [violations, setViolations] = useState<RaceViolation[]>([]);
  const [violationCodes, setViolationCodes] = useState<ViolationCodeOption[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [showViolationForm, setShowViolationForm] = useState(false);
  const [showFinishForm, setShowFinishForm] = useState(false);
  const [violationForm, setViolationForm] = useState<ViolationFormState>(emptyViolationForm);
  const [editingViolation, setEditingViolation] = useState<RaceViolation | null>(null);
  const [deletingViolationId, setDeletingViolationId] = useState<number | null>(null);
  const [protests, setProtests] = useState<Protest[]>([]);
  const [protestsLoading, setProtestsLoading] = useState(false);
  const [protestsError, setProtestsError] = useState('');
  const [rulingProtest, setRulingProtest] = useState<Protest | null>(null);
  const [rulingForm, setRulingForm] = useState<ProtestRulingPayload>(emptyRulingForm);
  const [finishNotes, setFinishNotes] = useState('');
  const [finishValues, setFinishValues] = useState<Record<number, { position: string; time: string }>>({});
  const [careerJockeyId, setCareerJockeyId] = useState<number | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    if (!hasValidRaceId || raceId == null) {
      const timer = window.setTimeout(() => {
        setError('Không tìm thấy raceId để mở Race Console.');
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [assignments, entryList, statusResult, violationList, codes] = await Promise.all([
          getMyRefereeRaceAssignments().catch(() => []),
          getRefereeRaceEntries(raceId),
          getRaceLiveStatus(raceId).catch(() => null),
          getRaceViolations(raceId),
          getViolationCodes(),
        ]);
        setAssignment(assignments.find((item) => item.raceId === raceId) ?? null);
        setEntries(entryList);
        setLiveStatus(statusResult);
        setViolations(violationList);
        setViolationCodes(codes);
        if (!statusResult) {
          setLiveError('Không tải được trạng thái Live Race. Hãy thử bấm Làm mới.');
        }
      } catch (err) {
        setEntries([]);
        setError(err instanceof Error ? err.message : 'Không tải được danh sách race entries.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [hasValidRaceId, raceId]);

  const loadProtests = useCallback(async () => {
    if (!raceId || !hasValidRaceId) return;
    try {
      setProtestsLoading(true);
      setProtestsError('');
      setProtests(await getProtestsByRace(raceId));
    } catch (err) {
      setProtestsError(err instanceof Error ? err.message : 'Không tải được khiếu nại của cuộc đua.');
    } finally {
      setProtestsLoading(false);
    }
  }, [hasValidRaceId, raceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProtests(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProtests]);

  const refreshLiveData = useCallback(async (showLoading = false) => {
    if (!raceId) return;
    try {
      if (showLoading) setLiveLoading(true);
      setLiveError('');
      const [statusResult, violationList] = await Promise.all([
        getRaceLiveStatus(raceId),
        getRaceViolations(raceId),
      ]);
      setLiveStatus(statusResult);
      setViolations(violationList);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Không tải được trạng thái cuộc đua.');
    } finally {
      if (showLoading) setLiveLoading(false);
    }
  }, [raceId]);

  useEffect(() => {
    if (!raceId || liveStatus?.status?.toLowerCase() !== 'live') return;
    const intervalId = window.setInterval(() => refreshLiveData(false), 4000);
    return () => window.clearInterval(intervalId);
  }, [raceId, liveStatus?.status, refreshLiveData]);

  const checkedCount = useMemo(
    () => entries.filter((item) => item.independenceCheckStatus || item.hasIndependenceWarning).length,
    [entries]
  );

  const handleIndependenceCheck = async (entry: RefereeRaceEntry) => {
    if (!raceId) {
      showToast('Không tìm thấy raceId để đồng bộ Independence Check.');
      return;
    }

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
      try {
        setEntries(await getRefereeRaceEntries(raceId));
        showToast(result.message || 'Đã kiểm tra độc lập Jockey.');
      } catch {
        showToast(
          `${result.message || 'Đã kiểm tra độc lập Jockey.'} Chưa thể làm mới danh sách từ API.`
        );
      }
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

  const handleStartRace = async () => {
    if (!raceId || !window.confirm('Bạn có chắc muốn bắt đầu cuộc đua?')) return;
    try {
      setSavingKey('start-race');
      await startRace(raceId);
      await refreshLiveData();
      showToast('Cuộc đua đã bắt đầu.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể bắt đầu cuộc đua.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateViolation = async () => {
    if (!raceId) return;
    const raceEntryId = Number(violationForm.raceEntryId);
    const placeBehindEntryId = violationForm.placeBehindEntryId
      ? Number(violationForm.placeBehindEntryId)
      : null;
    if (!Number.isInteger(raceEntryId) || raceEntryId <= 0 || !violationForm.violationCode || !violationForm.penalty) {
      showToast('Vui lòng chọn entry, nhập mã vi phạm và hình phạt.');
      return;
    }
    if (violationForm.penalty === 'PlaceBehind' && (!placeBehindEntryId || placeBehindEntryId <= 0)) {
      showToast('Hình phạt PlaceBehind bắt buộc chọn entry đích.');
      return;
    }
    try {
      setSavingKey('violation');
      await createRaceViolation(raceId, {
        raceEntryId,
        violationCode: violationForm.violationCode,
        penalty: violationForm.penalty,
        placeBehindEntryId: violationForm.penalty === 'PlaceBehind' ? placeBehindEntryId : null,
        description: violationForm.description.trim(),
      });
      setViolationForm(emptyViolationForm());
      setShowViolationForm(false);
      setViolations(await getRaceViolations(raceId));
      showToast('Đã ghi nhận vi phạm.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể ghi nhận vi phạm.');
    } finally {
      setSavingKey(null);
    }
  };

  const openEditViolation = (violation: RaceViolation) => {
    setShowViolationForm(false);
    setEditingViolation(violation);
    setViolationForm({
      raceEntryId: String(violation.raceEntryId),
      violationCode: violation.violationCode,
      penalty: PENALTIES.includes(violation.penalty as Penalty) ? violation.penalty as Penalty : '',
      placeBehindEntryId: violation.placeBehindEntryId ? String(violation.placeBehindEntryId) : '',
      description: violation.description,
    });
  };

  const handleUpdateViolation = async () => {
    if (!raceId || !editingViolation || !violationForm.penalty || !violationForm.violationCode) return;
    const placeBehindEntryId = violationForm.placeBehindEntryId ? Number(violationForm.placeBehindEntryId) : null;
    if (violationForm.penalty === 'PlaceBehind' && (!placeBehindEntryId || placeBehindEntryId <= 0)) {
      showToast('Hình phạt PlaceBehind bắt buộc chọn entry đích.');
      return;
    }
    const payload: UpdateViolationPayload = {
      violationCode: violationForm.violationCode,
      penalty: violationForm.penalty,
      placeBehindEntryId: violationForm.penalty === 'PlaceBehind' ? placeBehindEntryId : null,
      description: violationForm.description.trim(),
    };
    try {
      setSavingKey(`edit-violation-${editingViolation.violationId}`);
      let backendMessage = '';
      await updateRaceViolation(raceId, editingViolation.violationId, payload, (message) => { backendMessage = message; });
      setViolations(await getRaceViolations(raceId));
      setEditingViolation(null);
      setViolationForm(emptyViolationForm());
      showToast(backendMessage || 'Đã cập nhật vi phạm.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể cập nhật vi phạm.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteViolation = async (violation: RaceViolation) => {
    if (!raceId || deletingViolationId !== null || !window.confirm('Bạn có chắc muốn xóa vi phạm này không?')) return;
    try {
      setDeletingViolationId(violation.violationId);
      await deleteRaceViolation(raceId, violation.violationId);
      setViolations(await getRaceViolations(raceId));
      showToast('Đã xóa vi phạm.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể xóa vi phạm.');
    } finally {
      setDeletingViolationId(null);
    }
  };

  const openRuling = (protest: Protest) => {
    setRulingProtest(protest);
    setRulingForm(emptyRulingForm());
  };

  const handleRuleProtest = async () => {
    if (!rulingProtest || !raceId) return;
    const notes = rulingForm.notes.trim();
    if (notes.length < 10 || notes.length > 500) return showToast('Ghi chú phán quyết phải từ 10 đến 500 ký tự.');
    if (rulingForm.decision === 'Approved' && !rulingForm.penalty) return showToast('Phán quyết Approved bắt buộc có hình phạt.');
    if (rulingForm.penalty === 'PlaceBehind' && !rulingForm.placeBehindEntryId) return showToast('PlaceBehind bắt buộc chọn entry đích.');
    if (rulingForm.placeBehindEntryId === rulingProtest.accusedRaceEntryId) return showToast('Entry bị khiếu nại không thể là target PlaceBehind của chính nó.');
    try {
      setSavingKey(`ruling-${rulingProtest.protestId}`);
      let backendMessage = '';
      const result = await ruleProtest(rulingProtest.protestId, { ...rulingForm, notes }, (message) => { backendMessage = message; });
      setLiveStatus((current) => current ? {
        ...current,
        entries: current.entries.map((entry) => {
          const ranking = result.rankings.find((item) => item.raceEntryId === entry.raceEntryId);
          return ranking ? { ...entry, finishPosition: ranking.finishPosition, status: ranking.status } : entry;
        }),
      } : current);
      setEntries(await getRefereeRaceEntries(raceId));
      await loadProtests();
      setRulingProtest(null);
      showToast(backendMessage || 'Đã ghi nhận phán quyết.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể đưa ra phán quyết.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleFinishRace = async () => {
    if (!raceId || !liveStatus) return;
    const activeEntries = liveStatus.entries.filter((entry) => !entry.isWithdrawn);
    const results = activeEntries.map((entry) => ({
      raceEntryId: entry.raceEntryId,
      finishPosition: Number(finishValues[entry.raceEntryId]?.position),
      finishTime: Number(finishValues[entry.raceEntryId]?.time),
    }));
    const positions = results.map((item) => item.finishPosition);
    if (results.some((item) => !Number.isInteger(item.finishPosition) || item.finishPosition <= 0 || item.finishTime <= 0)) {
      showToast('Mỗi entry phải có thứ hạng nguyên dương và thời gian lớn hơn 0.');
      return;
    }
    if (new Set(positions).size !== positions.length) {
      showToast('Thứ hạng không được trùng nhau.');
      return;
    }
    if (!window.confirm('Kết thúc cuộc đua và lưu kết quả? Thao tác này khó hoàn tác.')) return;
    const payload: FinishRacePayload = { notes: finishNotes.trim(), results };
    try {
      setSavingKey('finish-race');
      await finishRace(raceId, payload);
      setShowFinishForm(false);
      await refreshLiveData();
      showToast('Đã kết thúc cuộc đua.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể kết thúc cuộc đua.');
    } finally {
      setSavingKey(null);
    }
  };

  const liveState = liveStatus?.status?.toLowerCase() ?? '';
  const isLive = liveState === 'live';
  const isFinished = liveState === 'finished' || liveState === 'completed' || liveState === 'unofficial';

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

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900">Điều hành cuộc đua</h2>
              {liveStatus && (
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    isLive
                      ? 'border-red-100 bg-red-50 text-red-700'
                      : isFinished
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                        : 'border-blue-100 bg-blue-50 text-blue-700'
                  }`}
                >
                  {isLive ? 'Đang diễn ra' : isFinished ? 'Đã hoàn thành' : liveStatus.status}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {liveStatus?.actualStartTime
                ? `Bắt đầu: ${formatDateTime(liveStatus.actualStartTime)}`
                : 'Cuộc đua chưa bắt đầu'}
              {liveStatus?.raceDurationSeconds != null && ` · Thời lượng: ${liveStatus.raceDurationSeconds} giây`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refreshLiveData(true)}
              disabled={liveLoading}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {liveLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
            {!isLive && !isFinished && (
              <button
                type="button"
                onClick={handleStartRace}
                disabled={!liveStatus || savingKey === 'start-race'}
                className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500"
              >
                {savingKey === 'start-race' ? 'Đang bắt đầu...' : 'Bắt đầu cuộc đua'}
              </button>
            )}
            {isLive && (
              <>
                <button
                  type="button"
                  onClick={() => setShowViolationForm((value) => !value)}
                  className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Ghi nhận vi phạm
                </button>
                <button
                  type="button"
                  onClick={() => setShowFinishForm((value) => !value)}
                  className="rounded-md bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  Kết thúc cuộc đua
                </button>
              </>
            )}
          </div>
        </div>

        {liveError && (
          <div className="m-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{liveError}</div>
        )}

        {!liveStatus && !liveError ? (
          <div className="p-8 text-center text-sm text-gray-500">Đang tải trạng thái cuộc đua...</div>
        ) : liveStatus?.entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Chưa có entry trong cuộc đua.</div>
        ) : liveStatus ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Post</th>
                  <th className="px-5 py-3 font-semibold">Ngựa / Kỵ sĩ</th>
                  <th className="px-5 py-3 font-semibold">Entry</th>
                  <th className="px-5 py-3 font-semibold">Thứ hạng</th>
                  <th className="px-5 py-3 font-semibold">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {liveStatus.entries.map((entry) => (
                  <tr key={entry.raceEntryId}>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-gray-500">{entry.postPosition ?? '—'}</td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{entry.horseName}</p>
                      <p className="text-xs text-gray-400">{entry.jockeyName}</p>
                      {entry.jockeyId != null && Number.isInteger(entry.jockeyId) && entry.jockeyId > 0 && (
                        <button
                          type="button"
                          onClick={() => setCareerJockeyId(entry.jockeyId)}
                          className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Xem thành tích Jockey
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4">{statusBadge(entry.isWithdrawn ? 'Withdrawn' : entry.status)}</td>
                    <td className="px-5 py-4 text-gray-700">{entry.finishPosition ?? '—'}</td>
                    <td className="px-5 py-4 text-gray-700">
                      {entry.finishTime != null ? `${entry.finishTime} giây` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {showViolationForm && isLive && liveStatus && (
          <div className="border-t border-gray-100 bg-gray-50 p-5">
            <h3 className="text-sm font-bold text-gray-900">Ghi nhận vi phạm</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                value={violationForm.raceEntryId}
                onChange={(event) => setViolationForm((prev) => ({ ...prev, raceEntryId: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Chọn ngựa / kỵ sĩ</option>
                {liveStatus.entries.filter((entry) => !entry.isWithdrawn).map((entry) => (
                  <option key={entry.raceEntryId} value={entry.raceEntryId}>
                    Post {entry.postPosition ?? '—'} · {entry.horseName} / {entry.jockeyName}
                  </option>
                ))}
              </select>
              <select
                value={violationForm.violationCode}
                onChange={(event) => setViolationForm((prev) => ({ ...prev, violationCode: event.target.value }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Chọn mã vi phạm</option>
                {violationCodes.map((code) => <option key={code.code} value={code.code}>{code.code} · {code.name}</option>)}
              </select>
              <select
                value={violationForm.penalty}
                onChange={(event) => setViolationForm((prev) => ({ ...prev, penalty: event.target.value as Penalty | '', placeBehindEntryId: event.target.value === 'PlaceBehind' ? prev.placeBehindEntryId : '' }))}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Chọn hình phạt</option>
                {PENALTIES.map((penalty) => <option key={penalty} value={penalty}>{penalty}</option>)}
              </select>
              {violationForm.penalty === 'PlaceBehind' && <select
                value={violationForm.placeBehindEntryId}
                onChange={(event) =>
                  setViolationForm((prev) => ({
                    ...prev,
                    placeBehindEntryId: event.target.value,
                  }))
                }
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Chọn entry xếp phía sau</option>
                {liveStatus.entries
                  .filter((entry) => String(entry.raceEntryId) !== violationForm.raceEntryId)
                  .map((entry) => (
                    <option key={entry.raceEntryId} value={entry.raceEntryId}>{entry.horseName}</option>
                  ))}
              </select>}
              <textarea
                value={violationForm.description}
                onChange={(event) => setViolationForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Mô tả chi tiết"
                rows={3}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm md:col-span-2"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowViolationForm(false)} className="rounded-md border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700">Hủy</button>
              <button type="button" onClick={handleCreateViolation} disabled={savingKey === 'violation'} className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {savingKey === 'violation' ? 'Đang lưu...' : 'Lưu vi phạm'}
              </button>
            </div>
          </div>
        )}

        {showFinishForm && isLive && liveStatus && (
          <div className="border-t border-gray-100 bg-gray-50 p-5">
            <h3 className="text-sm font-bold text-gray-900">Nhập kết quả cuộc đua</h3>
            <div className="mt-4 space-y-3">
              {liveStatus.entries.filter((entry) => !entry.isWithdrawn).map((entry) => (
                <div key={entry.raceEntryId} className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-white p-3 sm:grid-cols-[1fr_160px_160px] sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{entry.horseName}</p>
                    <p className="text-xs text-gray-400">{entry.jockeyName}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={finishValues[entry.raceEntryId]?.position ?? ''}
                    onChange={(event) => setFinishValues((prev) => ({ ...prev, [entry.raceEntryId]: { position: event.target.value, time: prev[entry.raceEntryId]?.time ?? '' } }))}
                    placeholder="Thứ hạng"
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={finishValues[entry.raceEntryId]?.time ?? ''}
                    onChange={(event) => setFinishValues((prev) => ({ ...prev, [entry.raceEntryId]: { position: prev[entry.raceEntryId]?.position ?? '', time: event.target.value } }))}
                    placeholder="Thời gian (giây)"
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <textarea value={finishNotes} onChange={(event) => setFinishNotes(event.target.value)} placeholder="Ghi chú cuộc đua" rows={3} className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowFinishForm(false)} className="rounded-md border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700">Hủy</button>
              <button type="button" onClick={handleFinishRace} disabled={savingKey === 'finish-race'} className="rounded-md bg-gray-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {savingKey === 'finish-race' ? 'Đang kết thúc...' : 'Xác nhận kết thúc'}
              </button>
            </div>
          </div>
        )}
        {editingViolation && isLive && liveStatus && (
          <div className="border-t border-gray-100 bg-blue-50/40 p-5">
            <h3 className="text-sm font-bold text-gray-900">Sửa vi phạm #{editingViolation.violationId}</h3>
            <p className="mt-1 text-xs text-gray-500">Race entry #{editingViolation.raceEntryId} · {editingViolation.horseName}</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select value={violationForm.violationCode} onChange={(event) => setViolationForm((prev) => ({ ...prev, violationCode: event.target.value }))} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                <option value="">Chọn mã vi phạm</option>
                {violationCodes.map((code) => <option key={code.code} value={code.code}>{code.code} · {code.name}</option>)}
              </select>
              <select value={violationForm.penalty} onChange={(event) => setViolationForm((prev) => ({ ...prev, penalty: event.target.value as Penalty | '', placeBehindEntryId: event.target.value === 'PlaceBehind' ? prev.placeBehindEntryId : '' }))} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                <option value="">Chọn hình phạt</option>
                {PENALTIES.map((penalty) => <option key={penalty} value={penalty}>{penalty}</option>)}
              </select>
              {violationForm.penalty === 'PlaceBehind' && <select value={violationForm.placeBehindEntryId} onChange={(event) => setViolationForm((prev) => ({ ...prev, placeBehindEntryId: event.target.value }))} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm md:col-span-2">
                <option value="">Chọn entry xếp phía sau</option>
                {liveStatus.entries.filter((entry) => entry.raceEntryId !== editingViolation.raceEntryId).map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>Entry #{entry.raceEntryId} · {entry.horseName}</option>)}
              </select>}
              <textarea value={violationForm.description} onChange={(event) => setViolationForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} placeholder="Mô tả vi phạm" className="rounded-md border border-gray-200 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setEditingViolation(null); setViolationForm(emptyViolationForm()); }} disabled={savingKey !== null} className="rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700">Hủy</button>
              <button type="button" onClick={handleUpdateViolation} disabled={savingKey === `edit-violation-${editingViolation.violationId}`} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingKey === `edit-violation-${editingViolation.violationId}` ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold uppercase text-gray-900">Khiếu nại của cuộc đua</h2>
            <p className="mt-1 text-xs text-gray-500">Xem và phán quyết các khiếu nại đang chờ xử lý.</p>
          </div>
          <button type="button" onClick={() => void loadProtests()} disabled={protestsLoading} className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50">{protestsLoading ? 'Đang tải...' : 'Làm mới'}</button>
        </div>
        {protestsError ? <div className="m-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><p>{protestsError}</p><button type="button" onClick={() => void loadProtests()} className="mt-2 text-xs font-bold underline">Thử lại</button></div> : protestsLoading ? <div className="p-10 text-center text-sm text-gray-500">Đang tải khiếu nại...</div> : protests.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Cuộc đua chưa có khiếu nại nào.</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Mã</th><th className="px-4 py-3">Entry bị khiếu nại</th><th className="px-4 py-3">Nội dung</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Phán quyết</th><th className="px-4 py-3">Hình phạt</th><th className="px-4 py-3">Ngày nộp</th><th className="px-4 py-3">Hành động</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{protests.map((protest) => <tr key={protest.protestId}><td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">#{protest.protestId}</td><td className="px-4 py-3">#{protest.accusedRaceEntryId}</td><td className="max-w-sm px-4 py-3 text-gray-600">{protest.description}</td><td className="px-4 py-3">{statusBadge(protest.status)}</td><td className="px-4 py-3">{protest.refereeDecision ?? '—'}</td><td className="px-4 py-3">{protest.penaltyApplied ?? '—'}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDateTime(protest.submittedAt)}</td><td className="px-4 py-3">{protest.status.toLowerCase() === 'pending' ? <button type="button" onClick={() => openRuling(protest)} disabled={savingKey !== null} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{savingKey === `ruling-${protest.protestId}` ? 'Đang xử lý...' : 'Đưa ra phán quyết'}</button> : '—'}</td></tr>)}</tbody></table></div>
        )}

        {rulingProtest && (
          <div className="border-t border-gray-100 bg-gray-50 p-5">
            <h3 className="text-sm font-bold text-gray-900">Phán quyết khiếu nại #{rulingProtest.protestId}</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <select value={rulingForm.decision} onChange={(event) => { const decision = event.target.value as ProtestDecision; setRulingForm((prev) => ({ ...prev, decision, penalty: decision === 'Rejected' ? null : prev.penalty, placeBehindEntryId: decision === 'Rejected' ? null : prev.placeBehindEntryId })); }} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"><option value="Rejected">Rejected</option><option value="Approved">Approved</option></select>
              {rulingForm.decision === 'Approved' && <select value={rulingForm.penalty ?? ''} onChange={(event) => { const penalty = event.target.value as Penalty | ''; setRulingForm((prev) => ({ ...prev, penalty: penalty || null, placeBehindEntryId: penalty === 'PlaceBehind' ? prev.placeBehindEntryId : null })); }} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"><option value="">Chọn hình phạt</option>{PENALTIES.map((penalty) => <option key={penalty} value={penalty}>{penalty}</option>)}</select>}
              {rulingForm.decision === 'Approved' && rulingForm.penalty === 'PlaceBehind' && <select value={rulingForm.placeBehindEntryId ?? ''} onChange={(event) => setRulingForm((prev) => ({ ...prev, placeBehindEntryId: event.target.value ? Number(event.target.value) : null }))} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm md:col-span-2"><option value="">Chọn target PlaceBehind</option>{(liveStatus?.entries ?? []).filter((entry) => entry.raceEntryId !== rulingProtest.accusedRaceEntryId).map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>Entry #{entry.raceEntryId} · {entry.horseName}</option>)}</select>}
              <textarea value={rulingForm.notes} onChange={(event) => setRulingForm((prev) => ({ ...prev, notes: event.target.value }))} maxLength={500} rows={4} placeholder="Ghi chú phán quyết (10–500 ký tự)" className="rounded-md border border-gray-200 px-3 py-2 text-sm md:col-span-2" />
            </div>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setRulingProtest(null)} disabled={savingKey !== null} className="rounded-md border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700">Hủy</button><button type="button" onClick={handleRuleProtest} disabled={savingKey === `ruling-${rulingProtest.protestId}`} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingKey === `ruling-${rulingProtest.protestId}` ? 'Đang xử lý...' : 'Xác nhận phán quyết'}</button></div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">Vi phạm cuộc đua</h2>
        </div>
        {violations.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Chưa có vi phạm nào được ghi nhận.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Entry</th>
                  <th className="px-5 py-3 font-semibold">Mã vi phạm</th>
                  <th className="px-5 py-3 font-semibold">Hình phạt</th>
                  <th className="px-5 py-3 font-semibold">Mô tả</th>
                  <th className="px-5 py-3 font-semibold">Thời gian</th>
                  <th className="px-5 py-3 font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {violations.map((violation) => (
                  <tr key={violation.violationId}>
                    <td className="px-5 py-4 text-gray-700">{violation.horseName || `#${violation.raceEntryId}`}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{violation.violationCode || '—'}</td>
                    <td className="px-5 py-4 text-gray-700">{violation.penalty || '—'}</td>
                    <td className="px-5 py-4 text-gray-500">{violation.description || '—'}</td>
                    <td className="px-5 py-4 text-gray-500">{formatDateTime(violation.loggedAt)}</td>
                    <td className="px-5 py-4">
                      {isLive ? <div className="flex gap-2">
                        <button type="button" onClick={() => openEditViolation(violation)} disabled={deletingViolationId !== null || savingKey !== null} className="rounded border border-blue-200 px-2.5 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-40">Sửa</button>
                        <button type="button" onClick={() => handleDeleteViolation(violation)} disabled={deletingViolationId !== null || savingKey !== null} className="rounded border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40">{deletingViolationId === violation.violationId ? 'Đang xóa...' : 'Xóa'}</button>
                      </div> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
                        <DoctorChecks entry={entry} />
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
                        <div className="flex flex-col items-end gap-2">
                        {entry.jockeyId != null && Number.isInteger(entry.jockeyId) && entry.jockeyId > 0 && (
                          <button
                            type="button"
                            onClick={() => setCareerJockeyId(entry.jockeyId)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Xem thành tích Jockey
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleIndependenceCheck(entry)}
                          disabled={savingKey === key}
                          className="rounded-md bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingKey === key ? 'Đang kiểm tra...' : 'Kiểm tra độc lập'}
                        </button>
                        </div>
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
      {careerJockeyId != null && (
        <JockeyCareerStatsModal
          jockeyId={careerJockeyId}
          onClose={() => setCareerJockeyId(null)}
        />
      )}
    </div>
  );
}
