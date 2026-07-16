/* eslint-disable react-hooks/set-state-in-effect -- Requests are intentionally driven by the selected filter. */
import { useEffect, useState } from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import {
  getHorseLeaderboard,
  getJockeyLeaderboard,
  type HorseLeaderboardEntry,
  type JockeyLeaderboardEntry,
  type LeaderboardMode,
} from '../../services/leaderboardService';
import styles from './Leaderboard.module.scss';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

const Leaderboard = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<LeaderboardMode>('points');
  const [horses, setHorses] = useState<HorseLeaderboardEntry[]>([]);
  const [jockeys, setJockeys] = useState<JockeyLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getTournaments()
      .then((items) => {
        if (!active) return;
        setTournaments(items);
        setSelectedId(items[0]?.tournamentId ?? null);
      })
      .catch(() => active && setError('Không tải được danh sách giải đấu. Vui lòng thử lại.'));
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      getHorseLeaderboard(selectedId, mode, controller.signal),
      getJockeyLeaderboard(selectedId, mode, controller.signal),
    ])
      .then(([horseItems, jockeyItems]) => {
        setHorses(horseItems);
        setJockeys(jockeyItems);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setHorses([]);
        setJockeys([]);
        setError(err instanceof Error ? err.message : 'Không tải được bảng xếp hạng. Vui lòng thử lại.');
      })
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [selectedId, mode]);

  const renderEmpty = (title: string) => (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}><FiTrendingUp size={24} /></div>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyDesc}>Chưa có dữ liệu xếp hạng chính thức cho giải đấu và tiêu chí đã chọn.</p>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Bảng xếp hạng</h1>
        <p className={styles.subtext}>Theo dõi thành tích ngựa và nài ngựa từ dữ liệu chính thức.</p>
      </div>

      <div className={styles.filterRow}>
        <select className={styles.select} value={selectedId ?? ''} onChange={(e) => setSelectedId(Number(e.target.value))} disabled={!tournaments.length}>
          {tournaments.map((tournament) => <option key={tournament.tournamentId} value={tournament.tournamentId}>{tournament.name}</option>)}
        </select>
        <select className={styles.select} value={mode} onChange={(e) => setMode(e.target.value as LeaderboardMode)}>
          <option value="points">Xếp theo điểm</option>
          <option value="earnings">Xếp theo tiền thưởng</option>
        </select>
      </div>

      {error && <div className={styles.errorMsg} role="alert"><span>{error}</span><button type="button" className={styles.retryBtn} onClick={() => setReloadKey((value) => value + 1)}>Thử lại</button></div>}
      {!loading && !error && tournaments.length === 0 && renderEmpty('Chưa có giải đấu')}

      {tournaments.length > 0 && (
        <>
          <section className={styles.tableCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Xếp hạng ngựa</h2>
              <p className={styles.sectionDesc}>Thành tích theo {mode === 'points' ? 'điểm' : 'tiền thưởng'}.</p>
            </div>
            {loading ? <p className={styles.loading}>Đang tải bảng xếp hạng ngựa...</p> : horses.length === 0 ? renderEmpty('Chưa có xếp hạng ngựa') : (
              <table className={styles.table}>
                <thead><tr><th>Hạng</th><th>Ngựa</th><th>Số cuộc đua</th><th>Thắng</th><th>Điểm</th><th>Tiền thưởng</th><th>Tỷ lệ thắng</th></tr></thead>
                <tbody>{horses.map((entry) => <tr key={entry.horseId}><td className={styles.rank}>#{entry.rank}</td><td className={styles.name}>{entry.horseName ?? 'Chưa có tên'}</td><td>{entry.races}</td><td>{entry.wins}</td><td className={styles.points}>{entry.totalPoints}</td><td>{formatMoney(entry.totalEarnings)}</td><td>{entry.winRate.toLocaleString('vi-VN')}%</td></tr>)}</tbody>
              </table>
            )}
          </section>

          <section className={styles.tableCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Xếp hạng nài ngựa</h2>
              <p className={styles.sectionDesc}>Thành tích theo {mode === 'points' ? 'điểm' : 'tiền thưởng'}.</p>
            </div>
            {loading ? <p className={styles.loading}>Đang tải bảng xếp hạng nài ngựa...</p> : jockeys.length === 0 ? renderEmpty('Chưa có xếp hạng nài ngựa') : (
              <table className={styles.table}>
                <thead><tr><th>Hạng</th><th>Nài ngựa</th><th>Số cuộc đua</th><th>Thắng</th><th>Điểm</th><th>Tiền thưởng</th><th>Tỷ lệ thắng</th></tr></thead>
                <tbody>{jockeys.map((entry) => <tr key={entry.jockeyId}><td className={styles.rank}>#{entry.rank}</td><td className={styles.name}>{entry.jockeyName ?? 'Chưa có tên'}</td><td>{entry.races}</td><td>{entry.wins}</td><td className={styles.points}>{entry.totalPoints}</td><td>{formatMoney(entry.totalEarnings)}</td><td>{entry.winRate.toLocaleString('vi-VN')}%</td></tr>)}</tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default Leaderboard;
