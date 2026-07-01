import { useEffect, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { getTournaments } from '../../services/tournamentService';
import {
  getRaceEntries,
  allocateEntry,
  drawPostPositions,
  type RaceSchedule,
} from '../../services/raceOperationService';
import styles from './RaceOperation.module.scss';
``
interface TournamentOption { id: number; name: string; }
interface RaceOption { id: number; label: string; }

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00 ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
};

const RaceOperations = () => {
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);

  const [schedule, setSchedule] = useState<RaceSchedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const [pairingId, setPairingId] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  // Load tournament list
  useEffect(() => {
    getTournaments().then((list) => {
      const opts = list.map((t) => ({ id: t.tournamentId, name: t.name }));
      setTournaments(opts);
      if (opts.length > 0) setSelectedTournamentId(opts[0].id);
    }).catch(() => {});
  }, []);

  // Build race options từ tournament đã chọn
  useEffect(() => {
    if (!selectedTournamentId) return;
    getTournaments().then((list) => {
      const t = list.find((x) => x.tournamentId === selectedTournamentId);
      if (!t) return;
      const opts: RaceOption[] = t.rounds.flatMap((r) =>
        r.races.map((race) => ({
          id: race.raceId,
          label: `Race #${race.raceNumber} · ${formatDateTime(race.scheduledTime)}`,
        }))
      );
      setRaces(opts);
      if (opts.length > 0) setSelectedRaceId(opts[0].id);
    }).catch(() => {});
  }, [selectedTournamentId]);

  // Load starting list khi chọn race
  useEffect(() => {
    if (!selectedRaceId) return;
    setLoadingSchedule(true);
    setSchedule(null);
    getRaceEntries(selectedRaceId)
      .then(setSchedule)
      .catch(() => {})
      .finally(() => setLoadingSchedule(false));
  }, [selectedRaceId]);

  const handleAllocate = async () => {
    if (!selectedRaceId || !pairingId.trim()) return;
    setAllocating(true);
    setActionMsg('');
    setActionError('');
    try {
      await allocateEntry(selectedRaceId, Number(pairingId));
      setActionMsg('Allocate thành công!');
      setPairingId('');
      // Reload starting list
      const updated = await getRaceEntries(selectedRaceId);
      setSchedule(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Allocate thất bại.');
    } finally {
      setAllocating(false);
    }
  };

  const handleDraw = async () => {
    if (!selectedRaceId) return;
    setDrawing(true);
    setActionMsg('');
    setActionError('');
    try {
      await drawPostPositions(selectedRaceId);
      setActionMsg('Bốc thăm thành công!');
      const updated = await getRaceEntries(selectedRaceId);
      setSchedule(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Bốc thăm thất bại.');
    } finally {
      setDrawing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Race Operations</h2>
        <p className={styles.sectionDesc}>Allocate Pairing vào RaceEntry và bốc thăm post position theo Module E.</p>
      </div>

      {/* ── Filters ── */}
      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Tournament</label>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={selectedTournamentId ?? ''}
                onChange={(e) => setSelectedTournamentId(Number(e.target.value))}
              >
                {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <FiChevronDown className={styles.selectIcon} size={14} />
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Race</label>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={selectedRaceId ?? ''}
                onChange={(e) => setSelectedRaceId(Number(e.target.value))}
              >
                {races.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <FiChevronDown className={styles.selectIcon} size={14} />
            </div>
          </div>
        </div>

        <div className={styles.actionRow}>
          <div className={styles.inputGroup}>
            <label className={styles.filterLabel}>Confirmed Pairing ID</label>
            <input
              className={styles.input}
              type="number"
              placeholder="Nhập Pairing ID..."
              value={pairingId}
              onChange={(e) => setPairingId(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.allocateBtn}
            onClick={handleAllocate}
            disabled={allocating || !pairingId.trim()}
          >
            {allocating ? 'Đang xử lý...' : 'Allocate'}
          </button>
          <button
            type="button"
            className={styles.drawBtn}
            onClick={handleDraw}
            disabled={drawing}
          >
            {drawing ? 'Đang bốc...' : 'Draw post positions'}
          </button>
        </div>

        {actionMsg && <p className={styles.successMsg}>{actionMsg}</p>}
        {actionError && <p className={styles.errorMsg}>{actionError}</p>}
      </div>

      {/* ── Starting list ── */}
      <div className={styles.tableCard}>
        <h3 className={styles.tableTitle}>Starting list</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Gate</th>
                <th>Horse</th>
                <th>Jockey</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {loadingSchedule ? (
                <tr><td colSpan={6} className={styles.emptyCell}>Đang tải...</td></tr>
              ) : !schedule || schedule.entries.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyCell}>Chưa có entry nào.</td></tr>
              ) : (
                schedule.entries.map((entry) => (
                  <tr key={entry.raceEntryId}>
                    <td className={styles.gate}>{entry.postPosition ?? '—'}</td>
                    <td className={styles.name}>{entry.horseName}</td>
                    <td>{entry.jockeyName}</td>
                    <td>—</td>
                    <td>
                      <span className={`${styles.badge} ${entry.status === 'Confirmed' ? styles.confirmed : styles.pending}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td>—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RaceOperations;