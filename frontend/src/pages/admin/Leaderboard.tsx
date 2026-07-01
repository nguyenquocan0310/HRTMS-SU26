import { useEffect, useState } from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import { apiFetch } from '../../services/apiClient';
import styles from './Leaderboard.module.scss';

interface LeaderboardEntry {
  rank: number;
  horseName: string;
  ownerName: string;
  jockeyName: string;
  points: number;
  wins: number;
  races: number;
}

const Leaderboard = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getTournaments().then((list) => {
      setTournaments(list);
      if (list.length > 0) setSelectedId(list[0].tournamentId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setError('');
    // TODO: thay bằng endpoint leaderboard thật khi BE expose
    // GET /api/tournament/{id}/leaderboard
    apiFetch<{ success: boolean; data: LeaderboardEntry[] }>(
      `/tournament/${selectedId}/leaderboard`
    )
      .then((res) => setEntries(res.data ?? []))
      .catch(() => { setEntries([]); setError(''); }) // Chưa có API — để trống
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <span className={styles.noFeedBadge}>No ranking feed</span>
        <h2 className={styles.sectionTitle}>Leaderboard & Standings</h2>
        <p className={styles.sectionDesc}>Official standings will appear here when the backend exposes ranking data.</p>
      </div>

      <div className={styles.filterRow}>
        <select
          className={styles.select}
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(Number(e.target.value))}
        >
          {tournaments.map((t) => <option key={t.tournamentId} value={t.tournamentId}>{t.name}</option>)}
        </select>
      </div>

      <div className={styles.tableCard}>
        {loading ? (
          <p className={styles.loading}>Đang tải...</p>
        ) : error ? (
          <p className={styles.errorMsg}>{error}</p>
        ) : entries.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><FiTrendingUp size={24} /></div>
            <h3 className={styles.emptyTitle}>No standings available</h3>
            <p className={styles.emptyDesc}>Connect this screen to the official leaderboard API when that endpoint is available.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>#</th><th>Horse</th><th>Owner</th><th>Jockey</th><th>Wins</th><th>Races</th><th>Points</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.rank}>
                  <td className={styles.rank}>#{e.rank}</td>
                  <td className={styles.name}>{e.horseName}</td>
                  <td>{e.ownerName}</td>
                  <td>{e.jockeyName}</td>
                  <td>{e.wins}</td>
                  <td>{e.races}</td>
                  <td className={styles.points}>{e.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;