/* eslint-disable react-hooks/set-state-in-effect -- Server polling synchronizes external race status. */
import { useEffect, useMemo, useState } from 'react';
import { FiMonitor, FiRefreshCw } from 'react-icons/fi';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import { getLiveRaceStatus, getRaceViolations, type LiveRaceStatus, type RaceViolation } from '../../services/liveRaceService';
import styles from './LiveRaceView.module.scss';

interface RaceOption { raceId: number; label: string; scheduledTime: string; }

const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có dữ liệu';
const statusLabel = (value: string) => ({
  Upcoming: 'Sắp diễn ra', 'Pre-Race': 'Trước giờ đua', Live: 'Đang diễn ra', Unofficial: 'Chờ xác nhận kết quả', Official: 'Đã công bố kết quả', Cancelled: 'Đã hủy',
}[value] ?? 'Đã cập nhật');
const penaltyLabel = (value: string) => ({ Disqualified: 'Loại khỏi cuộc đua', PlaceBehind: 'Xếp sau', Warning: 'Cảnh cáo', Scratch: 'Rút khỏi danh sách' }[value] ?? 'Đã ghi nhận');

const LiveRaceView = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [status, setStatus] = useState<LiveRaceStatus | null>(null);
  const [violations, setViolations] = useState<RaceViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const races = useMemo<RaceOption[]>(() => tournaments.flatMap((tournament) => tournament.rounds.flatMap((round) => round.races.map((race) => ({
    raceId: race.raceId,
    scheduledTime: race.scheduledTime,
    label: `${tournament.name} — ${round.name} — Cuộc đua #${race.raceNumber}`,
  })))), [tournaments]);

  useEffect(() => {
    getTournaments()
      .then((items) => {
        setTournaments(items);
        const allRaces = items.flatMap((tournament) => tournament.rounds.flatMap((round) => round.races));
        const liveRace = allRaces.find((race) => race.status === 'Live');
        setSelectedRaceId(liveRace?.raceId ?? allRaces[0]?.raceId ?? null);
      })
      .catch(() => setError('Không tải được danh sách cuộc đua. Vui lòng thử lại.'))
      .finally(() => setLoading(false));
  }, []);

  const loadRace = async (raceId: number, background = false) => {
    if (background) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [raceStatus, raceViolations] = await Promise.all([getLiveRaceStatus(raceId), getRaceViolations(raceId)]);
      setStatus(raceStatus);
      setViolations(raceViolations);
      setUpdatedAt(new Date());
    } catch (requestError) {
      setStatus(null);
      setViolations([]);
      setError(requestError instanceof Error ? requestError.message : 'Không tải được dữ liệu cuộc đua.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!selectedRaceId) return;
    void loadRace(selectedRaceId);
  }, [selectedRaceId]);

  useEffect(() => {
    if (!selectedRaceId || status?.status !== 'Live') return;
    const timer = window.setInterval(() => void loadRace(selectedRaceId, true), 5_000);
    return () => window.clearInterval(timer);
  }, [selectedRaceId, status?.status]);

  const selectedRace = races.find((race) => race.raceId === selectedRaceId);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}><h1 className={styles.heading}>Theo dõi cuộc đua</h1><p className={styles.subtext}>Dữ liệu trạng thái và vi phạm được cập nhật từ hệ thống.</p></div>
      <div className={styles.controls}>
        <select className={styles.select} value={selectedRaceId ?? ''} onChange={(event) => setSelectedRaceId(Number(event.target.value))} disabled={!races.length}>
          {races.map((race) => <option key={race.raceId} value={race.raceId}>{race.label}</option>)}
        </select>
        <button type="button" className={styles.refreshBtn} onClick={() => selectedRaceId && void loadRace(selectedRaceId, true)} disabled={!selectedRaceId || refreshing}><FiRefreshCw size={15} /> {refreshing ? 'Đang cập nhật...' : 'Cập nhật'}</button>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading ? <div className={styles.card}><p className={styles.loading}>Đang tải dữ liệu cuộc đua...</p></div> : !selectedRaceId ? <div className={styles.card}><div className={styles.empty}><div className={styles.emptyIcon}><FiMonitor size={24} /></div><h3 className={styles.emptyTitle}>Chưa có cuộc đua</h3><p className={styles.emptyDesc}>Chưa có cuộc đua nào để theo dõi trực tiếp.</p></div></div> : status && (
        <>
          <section className={styles.summaryGrid}>
            <div className={styles.summaryItem}><span>Cuộc đua</span><strong>{selectedRace?.label ?? `Cuộc đua #${status.raceId}`}</strong></div>
            <div className={styles.summaryItem}><span>Trạng thái</span><strong>{statusLabel(status.status)}</strong></div>
            <div className={styles.summaryItem}><span>Lịch dự kiến</span><strong>{formatDateTime(status.scheduledTime ?? selectedRace?.scheduledTime ?? null)}</strong></div>
            <div className={styles.summaryItem}><span>Bắt đầu thực tế</span><strong>{formatDateTime(status.actualStartTime)}</strong></div>
          </section>
          <p className={styles.updated}>Cập nhật gần nhất: {updatedAt ? updatedAt.toLocaleTimeString('vi-VN') : 'Chưa có dữ liệu'}{status.status === 'Live' ? ' — tự động làm mới mỗi 5 giây.' : ''}</p>

          <section className={styles.card}><h2 className={styles.sectionTitle}>Danh sách ngựa và nài ngựa</h2>
            {status.entries.length === 0 ? <p className={styles.emptyText}>Chưa có dữ liệu danh sách xuất phát từ hệ thống.</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Vị trí</th><th>Ngựa</th><th>Nài ngựa</th><th>Trạng thái</th><th>Kết quả</th></tr></thead><tbody>{status.entries.map((entry) => <tr key={entry.raceEntryId}><td>{entry.postPosition ?? '—'}</td><td>{entry.horseName}</td><td>{entry.jockeyName}</td><td>{entry.isWithdrawn ? 'Đã rút' : statusLabel(entry.status)}</td><td>{entry.finishPosition ? `Hạng ${entry.finishPosition}${entry.finishTime ? ` — ${entry.finishTime}s` : ''}` : 'Chưa có dữ liệu'}</td></tr>)}</tbody></table></div>}
          </section>
          <section className={styles.card}><h2 className={styles.sectionTitle}>Vi phạm đã ghi nhận</h2>
            {violations.length === 0 ? <p className={styles.emptyText}>Chưa có vi phạm được ghi nhận.</p> : <ul className={styles.violations}>{violations.map((violation) => <li key={violation.violationId}><strong>{violation.horseName}</strong><span>{penaltyLabel(violation.penalty)} — {violation.description || 'Chưa có mô tả chi tiết.'}</span><small>{formatDateTime(violation.loggedAt)}</small></li>)}</ul>}
          </section>
        </>
      )}
    </div>
  );
};

export default LiveRaceView;
