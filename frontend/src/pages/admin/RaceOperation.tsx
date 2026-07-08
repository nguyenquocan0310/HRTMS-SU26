import { useEffect, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import {
  getRaceEntries, allocateEntry, drawPostPositions, type RaceSchedule,
} from '../../services/raceOperationService';
import styles from './RaceOperation.module.scss';

interface RaceOption { id: number; label: string; isDrawn: boolean; }

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00 ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
};

const RaceOperations = () => {
  const [tournamentList, setTournamentList] = useState<TournamentResponse[]>([]);
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

  // Load tournament list once
  useEffect(() => {
    getTournaments().then((list) => {
      setTournamentList(list);
      if (list.length > 0) setSelectedTournamentId(list[0].tournamentId);
    }).catch(() => {});
  }, []);

  // Build race options from cached tournamentList
  useEffect(() => {
    if (!selectedTournamentId || tournamentList.length === 0) return;
    const t = tournamentList.find((x) => x.tournamentId === selectedTournamentId);
    if (!t) return;
    const opts: RaceOption[] = t.rounds.flatMap((r) =>
      r.races.map((race) => ({
        id: race.raceId,
        label: `Race #${race.raceNumber} · ${formatDateTime(race.scheduledTime)}`,
        isDrawn: race.status !== 'Upcoming',
      }))
    );
    setRaces(opts);
    if (opts.length > 0) setSelectedRaceId(opts[0].id);
    else setSelectedRaceId(null);
  }, [selectedTournamentId, tournamentList]);

  // Load starting list when race changes
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
    setActionMsg(''); setActionError('');
    try {
      await allocateEntry(selectedRaceId, Number(pairingId));
      setActionMsg('Allocate thành công!');
      setPairingId('');
      const updated = await getRaceEntries(selectedRaceId);
      setSchedule(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Allocate thất bại.');
    } finally { setAllocating(false); }
  };

  const handleDraw = async () => {
    if (!selectedRaceId) return;
    setDrawing(true);
    setActionMsg(''); setActionError('');
    try {
      await drawPostPositions(selectedRaceId);
      setActionMsg('Bốc thăm thành công!');
      const updated = await getRaceEntries(selectedRaceId);
      setSchedule(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Bốc thăm thất bại.');
    } finally { setDrawing(false); }
  };

  const currentRace = races.find((r) => r.id === selectedRaceId);
  const isDrawn = schedule?.isPostPositionDrawn ?? currentRace?.isDrawn ?? false;

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

      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Tournament</label>
            <div className={styles.selectWrap}>
              <select className={styles.select} value={selectedTournamentId ?? ''}
                onChange={(e) => setSelectedTournamentId(Number(e.target.value))}>
                {tournamentList.map((t) => <option key={t.tournamentId} value={t.tournamentId}>{t.name}</option>)}
              </select>
              <FiChevronDown className={styles.selectIcon} size={14} />
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Race</label>
            <div className={styles.selectWrap}>
              <select className={styles.select} value={selectedRaceId ?? ''}
                onChange={(e) => setSelectedRaceId(Number(e.target.value))}>
                {races.length === 0
                  ? <option value="">-- Chưa có race --</option>
                  : races.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)
                }
              </select>
              <FiChevronDown className={styles.selectIcon} size={14} />
            </div>
          </div>
        </div>

        <div className={styles.actionRow}>
          <div className={styles.inputGroup}>
            <label className={styles.filterLabel}>Confirmed Pairing ID</label>
            <input className={styles.input} type="number"
              placeholder="Nhập Pairing ID..."
              value={pairingId} onChange={(e) => setPairingId(e.target.value)} />
          </div>
          <button type="button" className={styles.allocateBtn} onClick={handleAllocate}
            disabled={allocating || !pairingId.trim() || !selectedRaceId}>
            {allocating ? 'Đang xử lý...' : 'Allocate'}
          </button>
          {isDrawn ? (
            <Link to="/admin/assign-officials" className={styles.assignOfficialsBtn}>
              Assign Officials →
            </Link>
          ) : (
            <button type="button" className={styles.drawBtn} onClick={handleDraw}
              disabled={drawing || !selectedRaceId}>
              {drawing ? 'Đang bốc...' : 'Draw post positions'}
            </button>
          )}
        </div>

        {actionMsg && <p className={styles.successMsg}>{actionMsg}</p>}
        {actionError && <p className={styles.errorMsg}>{actionError}</p>}
      </div>

      {/* Starting list */}
      <div className={styles.tableCard}>
        <h3 className={styles.tableTitle}>Starting list</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Gate</th><th>Horse</th><th>Jockey</th><th>Owner</th><th>Status</th><th>Fee</th></tr>
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