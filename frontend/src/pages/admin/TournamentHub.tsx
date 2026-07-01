import { useEffect, useState } from 'react';
import { FiUserPlus } from 'react-icons/fi';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import { getRaceEntries, type RaceSchedule } from '../../services/raceOperationService';
import useAuthStore from '../../store/authStore';
import { apiFetch } from '../../services/apiClient';
import styles from './TournamentHub.module.scss';

const formatVND = (n: number) => n.toLocaleString('vi-VN') + ' VND';
const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00 ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
};
const statusLabel = (s: string) => {
  const map: Record<string,string> = {
    OpenRegistration: 'Open registration', 'Open Registration': 'Open registration',
    Draft: 'Draft', Published: 'Published', Completed: 'Completed',
    Cancelled: 'Cancelled', 'Closed Registration': 'Closed registration',
    'Pre-Race': 'Pre-race', 'In-Progress': 'In progress',
  };
  return map[s] ?? s;
};

const TournamentHub = () => {
  const user = useAuthStore((s) => s.user);
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [raceSchedules, setRaceSchedules] = useState<Record<number, RaceSchedule>>({});
  const [regMsgs, setRegMsgs] = useState<Record<number, string>>({});
  const [registering, setRegistering] = useState<number | null>(null);

  useEffect(() => {
    getTournaments()
      .then(async (list) => {
        setTournaments(list);
        // Load tất cả race schedules
        const allRaces = list.flatMap((t) => t.rounds.flatMap((r) => r.races));
        const results: Record<number, RaceSchedule> = {};
        await Promise.allSettled(
          allRaces.map(async (race) => {
            try { results[race.raceId] = await getRaceEntries(race.raceId); } catch {}
          })
        );
        setRaceSchedules(results);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const canRegister = user?.role && ['Owner','Jockey','Doctor','Referee'].includes(user.role);

  const handleRegister = async (tournamentId: number) => {
    setRegistering(tournamentId);
    try {
      await apiFetch(`/tournament/${tournamentId}/participants`, { method: 'POST' });
      setRegMsgs((prev) => ({ ...prev, [tournamentId]: 'Đăng ký thành công! Chờ Admin duyệt.' }));
    } catch (e) {
      setRegMsgs((prev) => ({ ...prev, [tournamentId]: e instanceof Error ? e.message : 'Đăng ký thất bại.' }));
    } finally {
      setRegistering(null);
    }
  };

  if (loading) return <div className={styles.container}><p className={styles.loading}>Đang tải...</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Tournament Hub</h2>
        <p className={styles.sectionDesc}>Tournament roster, registration, rounds and public race entries shared across every workspace.</p>
      </div>

      {/* ── Tournament list (scroll, không navigate) ── */}
      <div className={styles.listCard}>
        <div className={styles.listHeader}>
          <h3 className={styles.listTitle}>Tournaments</h3>
          <p className={styles.listSubtext}>Select a tournament to inspect rounds and roster.</p>
        </div>

        {tournaments.length === 0 && <p className={styles.empty}>Chưa có giải đấu nào.</p>}

        {tournaments.map((t) => (
          <div key={t.tournamentId} className={styles.tournamentBlock}>
            {/* Tournament header */}
            <div className={styles.tournamentHeader}>
              <div>
                <span className={styles.tournamentName}>{t.name}</span>
                <span className={styles.tournamentMeta}>{t.allowedBreed} | {formatDateTime(t.startDate)}</span>
              </div>
              <span className={styles.statusBadge}>{statusLabel(t.status)}</span>
            </div>

            {/* Registration */}
            {(t.status === 'OpenRegistration' || t.status === 'Open Registration') && (
              <div className={styles.regCard}>
                <div className={styles.regLeft}>
                  <FiUserPlus size={20} className={styles.regIcon} />
                  <div>
                    <h4 className={styles.regTitle}>Registration</h4>
                    <p className={styles.regDesc}>Registration is open for eligible workspace roles.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.registerBtn}
                  onClick={() => handleRegister(t.tournamentId)}
                  disabled={registering === t.tournamentId || !canRegister}
                >
                  {registering === t.tournamentId ? 'Đang đăng ký...' : '🗒 Register for tournament'}
                </button>
                {!canRegister && <p className={styles.regNote}>Your role can view this hub but cannot join the tournament roster.</p>}
                {regMsgs[t.tournamentId] && <p className={styles.regMsg}>{regMsgs[t.tournamentId]}</p>}
              </div>
            )}

            {/* Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}><span className={styles.statLabel}>Breed</span><strong>{t.allowedBreed}</strong></div>
              <div className={styles.statCard}><span className={styles.statLabel}>Max horses</span><strong>{t.maxHorses}</strong></div>
              <div className={styles.statCard}><span className={styles.statLabel}>Entry fee</span><strong>{formatVND(t.entryFeeAmount)}</strong></div>
              <div className={styles.statCard}><span className={styles.statLabel}>Purse</span><strong>{formatVND(t.purseAmount)}</strong></div>
            </div>

            {/* Rounds & Races */}
            {t.rounds.map((round) => (
              <div key={round.roundId} className={styles.roundCard}>
                <div className={styles.roundHeader}>
                  <div>
                    <h3 className={styles.roundName}>{round.name}</h3>
                    <p className={styles.roundDate}>{formatDateTime(round.scheduledDate)}</p>
                  </div>
                  <span className={styles.upcomingBadge}>{round.status || 'Upcoming'}</span>
                </div>

                {round.races.map((race) => {
                  const schedule = raceSchedules[race.raceId];
                  return (
                    <div key={race.raceId} className={styles.raceCard}>
                      <div className={styles.raceHeader}>
                        <div>
                          <h4 className={styles.raceName}>Race #{race.raceNumber}</h4>
                          <p className={styles.raceMeta}>{formatDateTime(race.scheduledTime)} | {race.raceDistanceOverride ?? t.raceDistance}m</p>
                        </div>
                        <span className={styles.upcomingBadge}>{race.status || 'Upcoming'}</span>
                      </div>
                      <table className={styles.startTable}>
                        <thead><tr><th>GATE</th><th>HORSE</th><th>JOCKEY</th><th>STATUS</th><th>FEE</th></tr></thead>
                        <tbody>
                          {!schedule || schedule.entries.length === 0 ? (
                            <tr><td colSpan={5} className={styles.emptyCell}>No public start list yet.</td></tr>
                          ) : (
                            schedule.entries.map((e) => (
                              <tr key={e.raceEntryId}>
                                <td>{e.postPosition ?? '—'}</td>
                                <td className={styles.horseName}>{e.horseName}</td>
                                <td>{e.jockeyName}</td>
                                <td>{e.status}</td>
                                <td>—</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentHub;