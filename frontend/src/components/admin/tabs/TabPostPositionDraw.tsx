/* eslint-disable react-hooks/set-state-in-effect -- Data is synchronized from the selected server-side race. */
import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiShuffle } from 'react-icons/fi';
import { drawPostPositions, getRaceSchedule, type RaceEntriesData } from '../../../services/raceOperationService';
import type { Round } from '../TournamentBuilder';
import styles from './TabPostPositionDraw.module.scss';

interface Props {
  rounds: Round[];
  onChange: (rounds: Round[]) => void;
  readOnly?: boolean;
}

const friendlyError = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'Không thể bốc thăm vị trí xuất phát. Vui lòng thử lại.';

const TabPostPositionDraw = ({ rounds, onChange, readOnly }: Props) => {
  const allRaces = useMemo(() => rounds.flatMap((round) => round.races.map((race) => ({ round, race }))), [rounds]);
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [schedule, setSchedule] = useState<RaceEntriesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!allRaces.some(({ race }) => race.id === selectedRaceId)) {
      setSelectedRaceId(allRaces[0]?.race.id ?? '');
    }
  }, [allRaces, selectedRaceId]);

  const selected = allRaces.find(({ race }) => race.id === selectedRaceId);
  const raceId = selectedRaceId && /^\d+$/.test(selectedRaceId) ? Number(selectedRaceId) : null;

  const loadSchedule = async (id: number) => {
    setLoading(true);
    setError('');
    try {
      setSchedule(await getRaceSchedule(id));
    } catch (requestError) {
      setSchedule(null);
      setError(friendlyError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSuccess('');
    if (!raceId) {
      setSchedule(null);
      return;
    }
    void loadSchedule(raceId);
  }, [raceId]);

  const handleDraw = async () => {
    if (!selected || !raceId || drawing) return;
    setDrawing(true);
    setError('');
    setSuccess('');
    try {
      const result = await drawPostPositions(raceId);
      const refreshed = await getRaceSchedule(raceId);
      setSchedule(refreshed);
      onChange(rounds.map((round) => round.id !== selected.round.id ? round : {
        ...round,
        races: round.races.map((race) => race.id !== selected.race.id ? race : {
          ...race,
          isPostPositionDrawn: result.isPostPositionDrawn,
          entries: refreshed.entries.map((entry) => ({
            id: String(entry.raceEntryId),
            horseName: entry.horseName,
            postPosition: entry.postPosition,
          })),
        }),
      }));
      setSuccess('Đã bốc thăm vị trí xuất phát. Danh sách đã được cập nhật từ hệ thống.');
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setDrawing(false);
    }
  };

  if (allRaces.length === 0) {
    return <div className={styles.container}><div className={styles.emptyState}>Chưa có cuộc đua nào. Vui lòng thêm vòng đấu và cuộc đua trước.</div></div>;
  }

  const entries = schedule?.entries ?? [];
  const isDrawn = schedule?.isPostPositionDrawn ?? selected?.race.isPostPositionDrawn ?? false;

  return (
    <div className={styles.container}>
      <div className={styles.raceSelectWrap}>
        <label className={styles.raceSelectLabel} htmlFor="post-position-race">Chọn cuộc đua</label>
        <select id="post-position-race" className={styles.raceSelect} value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)}>
          {allRaces.map(({ round, race }) => <option key={race.id} value={race.id}>{round.name} — Cuộc đua #{race.raceNumber}{race.scheduledDate ? ` (${race.scheduledDate})` : ''}</option>)}
        </select>
      </div>

      {!raceId && <div className={styles.emptyState}>Hãy lưu giải đấu và cuộc đua trước khi thực hiện bốc thăm.</div>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {success && <p className={styles.success}>{success}</p>}

      {selected && raceId && <>
        <div className={styles.statusRow}>
          {isDrawn ? <span className={styles.drawnBadge}><FiCheckCircle size={14} /> Đã bốc thăm</span> : <span className={styles.notDrawnBadge}>Chưa bốc thăm</span>}
          {!readOnly && <button type="button" className={styles.randomizeBtn} onClick={() => void handleDraw()} disabled={drawing || loading || isDrawn || entries.length === 0}>
            <FiShuffle size={15} /> {drawing ? 'Đang bốc thăm...' : 'Bốc thăm vị trí'}
          </button>}
        </div>

        {loading ? <div className={styles.emptyState}>Đang tải danh sách xuất phát...</div> : entries.length === 0 ? <div className={styles.emptyState}>Chưa có ngựa hợp lệ trong cuộc đua này để bốc thăm.</div> : (
          <div className={styles.entriesTable}>
            <div className={styles.entriesHeader}><span>Tên ngựa</span><span>Nài ngựa</span><span>Vị trí xuất phát</span></div>
            {entries.map((entry) => <div key={entry.raceEntryId} className={styles.entryRow}><span className={styles.horseName}>{entry.horseName}</span><span>{entry.jockeyName}</span><span className={`${styles.postPosition} ${entry.postPosition ? styles.postPositionAssigned : ''}`}>{entry.postPosition ?? '—'}</span></div>)}
          </div>
        )}
      </>}
    </div>
  );
};

export default TabPostPositionDraw;
