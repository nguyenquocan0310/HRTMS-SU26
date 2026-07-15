import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../../services/apiClient';
import { getMyJockeyRaceEntries } from '../../services/jockeyService';
import { getMyRaceEntries } from '../../services/ownerService';
import { getProtestsByRace, submitProtest } from '../../services/protestService';
import { getRaceLiveStatus, getRaceViolations } from '../../services/refereeService';
import type { LiveRaceEntry, RaceViolation } from '../../services/refereeService';
import type { Protest as ProtestRecord } from '../../types/protest.types';

interface ProtestProps {
  userRole: 'HorseOwner' | 'Jockey';
}

interface RaceOption {
  raceId: number;
  label: string;
}

interface ProfileResponse {
  success: boolean;
  message: string;
  data: { userId: number } | null;
}

const MIN_DESCRIPTION = 20;
const MAX_DESCRIPTION = 500;
const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';

const positiveId = (value: string | null): number | null => {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const formatDateTime = (value: string | null) => value
  ? new Date(value).toLocaleString('vi-VN')
  : '—';

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const color = normalized === 'pending'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : normalized === 'approved'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized === 'rejected'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-gray-200 bg-gray-50 text-gray-700';
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>{status}</span>;
}

export default function Protest({ userRole }: ProtestProps) {
  const location = useLocation();
  const queryRaceId = useMemo(
    () => positiveId(new URLSearchParams(location.search).get('raceId')),
    [location.search]
  );
  const [userId, setUserId] = useState<number | null>(null);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [raceId, setRaceId] = useState('');
  const [accusedEntryId, setAccusedEntryId] = useState('');
  const [violationId, setViolationId] = useState('');
  const [description, setDescription] = useState('');
  const [entries, setEntries] = useState<LiveRaceEntry[]>([]);
  const [violations, setViolations] = useState<RaceViolation[]>([]);
  const [protests, setProtests] = useState<ProtestRecord[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [raceLoading, setRaceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedRaceId = positiveId(raceId);
  const roleLabel = userRole === 'HorseOwner' ? 'Chủ ngựa' : 'Kỵ sĩ';

  useEffect(() => {
    let cancelled = false;
    const loadInitialData = async () => {
      try {
        setPageLoading(true);
        setError('');
        const profile = await apiFetch<ProfileResponse>('/auth/profile');
        if (!profile.success || profile.data === null) {
          throw new Error(profile.message || 'Không tải được thông tin người dùng.');
        }

        const options = new Map<number, RaceOption>();
        if (userRole === 'HorseOwner') {
          const ownerEntries = await getMyRaceEntries(undefined, undefined, 1, 100);
          ownerEntries.forEach((entry) => options.set(entry.race.raceId, {
            raceId: entry.race.raceId,
            label: `${entry.race.tournamentName} · Race #${entry.race.raceNumber} · ${formatDateTime(entry.race.scheduledTime)}`,
          }));
        } else {
          const jockeyEntries = await getMyJockeyRaceEntries(1, 100);
          jockeyEntries.items.forEach((entry) => options.set(entry.raceId, {
            raceId: entry.raceId,
            label: `${entry.tournamentName} · Race #${entry.raceNumber} · ${formatDateTime(entry.scheduledTime)}`,
          }));
        }

        if (cancelled) return;
        const raceOptions = Array.from(options.values());
        setUserId(profile.data.userId);
        setRaces(raceOptions);
        const initialRaceId = queryRaceId && options.has(queryRaceId)
          ? queryRaceId
          : raceOptions[0]?.raceId;
        setRaceId(initialRaceId ? String(initialRaceId) : '');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được dữ liệu khiếu nại.');
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };
    void loadInitialData();
    return () => { cancelled = true; };
  }, [queryRaceId, userRole]);

  const loadRaceData = useCallback(async () => {
    if (!selectedRaceId || !userId) {
      setEntries([]);
      setViolations([]);
      setProtests([]);
      return;
    }
    try {
      setRaceLoading(true);
      setError('');
      const [live, raceViolations, raceProtests] = await Promise.all([
        getRaceLiveStatus(selectedRaceId),
        getRaceViolations(selectedRaceId),
        getProtestsByRace(selectedRaceId),
      ]);
      setEntries(live.entries);
      setViolations(raceViolations);
      setProtests(raceProtests.filter((item) => item.submittedByUserId === userId));
    } catch (err) {
      setEntries([]);
      setViolations([]);
      setProtests([]);
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu của cuộc đua.');
    } finally {
      setRaceLoading(false);
    }
  }, [selectedRaceId, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRaceData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRaceData]);

  const handleRaceChange = (value: string) => {
    setRaceId(value);
    setAccusedEntryId('');
    setViolationId('');
    setSuccess('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const validRaceId = positiveId(raceId);
    const validEntryId = positiveId(accusedEntryId);
    const validViolationId = violationId ? positiveId(violationId) : null;
    const trimmedDescription = description.trim();
    if (!validRaceId) return setError('Vui lòng chọn cuộc đua.');
    if (!validEntryId) return setError('Vui lòng chọn race entry bị khiếu nại.');
    if (violationId && !validViolationId) return setError('Violation đã chọn không hợp lệ.');
    if (trimmedDescription.length < MIN_DESCRIPTION || trimmedDescription.length > MAX_DESCRIPTION) {
      return setError(`Nội dung khiếu nại phải từ ${MIN_DESCRIPTION} đến ${MAX_DESCRIPTION} ký tự.`);
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      let backendMessage = '';
      await submitProtest({
        raceId: validRaceId,
        accusedRaceEntryId: validEntryId,
        violationId: validViolationId,
        description: trimmedDescription,
      }, (message) => { backendMessage = message; });
      setAccusedEntryId('');
      setViolationId('');
      setDescription('');
      setSuccess(backendMessage || 'Đã nộp khiếu nại.');
      await loadRaceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể nộp khiếu nại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Khiếu nại kết quả</h1>
          <p className="mt-0.5 text-sm text-gray-500">Nộp khiếu nại và theo dõi tiến trình xử lý.</p>
        </div>
        <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{roleLabel}</span>
      </div>

      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3"><h2 className="text-sm font-semibold text-gray-700">Nộp khiếu nại mới</h2></div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Cuộc đua <span className="text-red-500">*</span></label>
            <select value={raceId} onChange={(event) => handleRaceChange(event.target.value)} disabled={pageLoading || submitting} className={inputClass}>
              <option value="">— Chọn cuộc đua —</option>
              {races.map((race) => <option key={race.raceId} value={race.raceId}>{race.label}</option>)}
            </select>
            {!pageLoading && races.length === 0 && <p className="mt-1 text-xs text-gray-500">Tài khoản chưa có race entry để gửi khiếu nại.</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Race entry bị khiếu nại <span className="text-red-500">*</span></label>
              <select value={accusedEntryId} onChange={(event) => setAccusedEntryId(event.target.value)} disabled={!selectedRaceId || raceLoading || submitting} className={inputClass}>
                <option value="">— Chọn entry —</option>
                {entries.map((entry) => <option key={entry.raceEntryId} value={entry.raceEntryId}>Entry #{entry.raceEntryId} · {entry.horseName} / {entry.jockeyName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Violation liên quan (không bắt buộc)</label>
              <select value={violationId} onChange={(event) => setViolationId(event.target.value)} disabled={!selectedRaceId || raceLoading || submitting} className={inputClass}>
                <option value="">— Không chọn violation —</option>
                {violations.map((item) => <option key={item.violationId} value={item.violationId}>#{item.violationId} · {item.violationCode} · {item.horseName}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Nội dung khiếu nại <span className="text-red-500">*</span></label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={MAX_DESCRIPTION} disabled={submitting} placeholder="Mô tả chi tiết nội dung khiếu nại..." className={`${inputClass} resize-none`} />
            <p className={`mt-1 text-right text-xs ${description.trim().length < MIN_DESCRIPTION ? 'text-red-400' : 'text-gray-400'}`}>{description.length}/{MAX_DESCRIPTION} ký tự (tối thiểu {MIN_DESCRIPTION})</p>
          </div>
          <div className="flex justify-end"><button type="submit" disabled={submitting || pageLoading || raceLoading || !selectedRaceId} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300">{submitting ? 'Đang gửi...' : 'Nộp khiếu nại'}</button></div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3"><h2 className="text-sm font-semibold text-gray-700">Khiếu nại đã nộp trong race</h2><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{protests.length}</span></div>
        {raceLoading ? <div className="p-10 text-center text-sm text-gray-500">Đang tải khiếu nại...</div> : protests.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">Bạn chưa nộp khiếu nại nào trong cuộc đua này.</div> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Mã</th><th className="px-4 py-3">Entry bị KN</th><th className="px-4 py-3">Nội dung</th><th className="px-4 py-3">Ngày nộp</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Phán quyết</th><th className="px-4 py-3">Hình phạt</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{protests.map((item) => <tr key={item.protestId}><td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">#{item.protestId}</td><td className="px-4 py-3">#{item.accusedRaceEntryId}</td><td className="max-w-sm px-4 py-3 text-gray-600">{item.description}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDateTime(item.submittedAt)}</td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="px-4 py-3">{item.refereeDecision ?? '—'}</td><td className="px-4 py-3">{item.penaltyApplied ?? '—'}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
