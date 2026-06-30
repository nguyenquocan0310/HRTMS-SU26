import { useEffect, useMemo, useState } from 'react';
import { FiZap, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import type { Round } from '../TournamentBuilder';
import styles from './TabRoster.module.scss';

// ─── Types (UI tạm thời — sẽ thay bằng response thật từ API roster) ─────────

export interface RosterEntry {
  id: string;
  horseName: string;
  ownerName: string;
  jockeyName: string;
  roundId: string | null;
  raceId: string | null;
  status: 'Assigned' | 'Waiting Allocation';
}

interface TabRosterProps {
  tournamentId: string;
  tournamentName: string;
  rounds: Round[];
  isNewDraft: boolean;
}

const TabRoster = ({ tournamentId, tournamentName, rounds, isNewDraft }: TabRosterProps) => {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // TODO(API): thay bằng gọi rosterService.getRoster(tournamentId) khi BE sẵn sàng.
  useEffect(() => {
    if (isNewDraft) return;
    setLoading(true);
    setError('');
    // Placeholder — chưa có endpoint thật, để mảng rỗng cho tới khi nối API.
    setRoster([]);
    setLoading(false);
  }, [tournamentId, isNewDraft]);

  const allRaces = useMemo(
    () =>
      rounds.flatMap((r) =>
        r.races.map((race) => ({ roundId: r.id, roundName: r.name, raceId: race.id, raceNumber: race.raceNumber }))
      ),
    [rounds]
  );

  const assigned = roster.filter((r) => r.status === 'Assigned');
  const waiting = roster.filter((r) => r.status === 'Waiting Allocation');

  const totalRegistered = roster.length;
  const approved = roster.length; // Roster chỉ chứa horse đã approve theo nghiệp vụ.
  const assignedCount = assigned.length;
  const waitingCount = waiting.length;

  // Validation đơn giản: mỗi race nên có roster — placeholder ngưỡng 8 horse/race.
  const RACE_CAPACITY = 8;
  const raceFillStatus = allRaces.map((race) => {
    const count = assigned.filter((a) => a.raceId === race.raceId).length;
    return { ...race, count, isFull: count >= RACE_CAPACITY, missing: Math.max(0, RACE_CAPACITY - count) };
  });

  if (isNewDraft) {
    return (
      <div className={styles.notice}>
        Lưu tournament trước khi xem roster. Roster chỉ có sau khi BE tạo TournamentId thật.
      </div>
    );
  }

  return (
    <div className={styles.rosterTab}>
      {/* ── Tổng quan ── */}
      <section className={styles.overviewCard}>
        <h3 className={styles.sectionTitle}>Tổng quan Tournament</h3>
        <div className={styles.overviewGrid}>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Tournament Name</span>
            <strong className={styles.overviewValue}>{tournamentName || '—'}</strong>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Registration</span>
            <strong className={styles.overviewValue}>Closed</strong>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Approved Horses</span>
            <strong className={styles.overviewValue}>{approved}</strong>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Total Rounds</span>
            <strong className={styles.overviewValue}>{rounds.length}</strong>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Total Races</span>
            <strong className={styles.overviewValue}>{allRaces.length}</strong>
          </div>
        </div>
      </section>

      {error && <div className={styles.errorBox}>{error}</div>}
      {loading && <p className={styles.loadingText}>Đang tải roster...</p>}

      {/* ── Stats ── */}
      <section className={styles.statsRow}>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{totalRegistered}</span>
          <span className={styles.statLabel}>Total Registered</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{approved}</span>
          <span className={styles.statLabel}>Approved</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{assignedCount}</span>
          <span className={styles.statLabel}>Assigned</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{waitingCount}</span>
          <span className={styles.statLabel}>Waiting</span>
        </div>
      </section>

      {/* ── Danh sách Roster (đã assign) ── */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.sectionTitle}>Danh sách Roster</h3>
          <button type="button" className={styles.autoAllocateBtn}>
            <FiZap size={14} /> Auto Allocate
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Horse</th>
                <th>Owner</th>
                <th>Jockey</th>
                <th>Round</th>
                <th>Race</th>
                <th>Allocation</th>
              </tr>
            </thead>
            <tbody>
              {assigned.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    Chưa có horse nào được phân race.
                  </td>
                </tr>
              ) : (
                assigned.map((entry) => {
                  const race = allRaces.find((r) => r.raceId === entry.raceId);
                  return (
                    <tr key={entry.id}>
                      <td className={styles.horseName}>{entry.horseName}</td>
                      <td>{entry.ownerName}</td>
                      <td>{entry.jockeyName}</td>
                      <td>{race?.roundName ?? '—'}</td>
                      <td>{race ? `Race ${race.raceNumber}` : '—'}</td>
                      <td>
                        <span className={styles.assignedBadge}>
                          <FiCheckCircle size={12} /> Assigned
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Horse chưa phân race ── */}
      <section className={styles.tableCard}>
        <h3 className={styles.sectionTitle}>Horse chưa được phân Race</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Horse</th>
                <th>Owner</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {waiting.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.emptyCell}>
                    Không có horse nào đang chờ phân race.
                  </td>
                </tr>
              ) : (
                waiting.map((entry) => (
                  <tr key={entry.id}>
                    <td className={styles.horseName}>{entry.horseName}</td>
                    <td>{entry.ownerName}</td>
                    <td>
                      <span className={styles.waitingBadge}>Waiting Allocation</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Validation ── */}
      <section className={styles.validationCard}>
        <h3 className={styles.sectionTitle}>Validation</h3>
        <ul className={styles.validationList}>
          {raceFillStatus.length === 0 ? (
            <li className={styles.validationItem}>
              <span className={styles.validationMuted}>Chưa có race nào để kiểm tra.</span>
            </li>
          ) : (
            raceFillStatus.map((race) => (
              <li key={race.raceId} className={styles.validationItem}>
                {race.isFull ? (
                  <span className={styles.validOk}>
                    <FiCheckCircle size={14} /> {race.roundName} - Race {race.raceNumber} đủ {RACE_CAPACITY} horse
                  </span>
                ) : (
                  <span className={styles.validWarn}>
                    <FiAlertTriangle size={14} /> {race.roundName} - Race {race.raceNumber} còn thiếu {race.missing} horse
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
};

export default TabRoster;