import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import type { Round } from '../TournamentBuilder';
import {
  getRoster,
  type ParticipantResponse,
} from '../../../services/participantService';
import styles from './TabRoster.module.scss';

interface TabRosterProps {
  tournamentId: string;
  tournamentName: string;
  rounds: Round[];
  isNewDraft: boolean;
}

const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN') : '—';

const RACE_CAPACITY = 8;

const TabRoster = ({ tournamentId, tournamentName, rounds, isNewDraft }: TabRosterProps) => {
  const [roster, setRoster] = useState<ParticipantResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNewDraft) return;
    const id = Number(tournamentId);
    if (!id) return;
    setLoading(true);
    setError('');
    getRoster(id)
      .then(setRoster)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tournamentId, isNewDraft]);

  const allRaces = useMemo(
    () =>
      rounds.flatMap((r) =>
        r.races.map((race) => ({
          roundId: r.id,
          roundName: r.name,
          raceId: race.id,
          raceNumber: race.raceNumber,
        }))
      ),
    [rounds]
  );

  const approved = roster.filter((r) => r.status === 'Approved');
  const pending = roster.filter((r) => r.status === 'Pending');

  // Stats
  const totalRegistered = roster.length;
  const approvedCount = approved.length;

  // Validation: mỗi race cần đủ RACE_CAPACITY horse — dùng approved count
  // chia đều làm placeholder vì chưa có mapping horse↔race từ API này.
  const raceFillStatus = allRaces.map((race, idx) => {
    const perRace = allRaces.length > 0 ? Math.floor(approvedCount / allRaces.length) : 0;
    const remainder = allRaces.length > 0 ? approvedCount % allRaces.length : 0;
    const count = perRace + (idx < remainder ? 1 : 0);
    return {
      ...race,
      count,
      isFull: count >= RACE_CAPACITY,
      missing: Math.max(0, RACE_CAPACITY - count),
    };
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
            <span className={styles.overviewLabel}>Approved</span>
            <strong className={styles.overviewValue}>{approvedCount}</strong>
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
          <span className={styles.statValue}>{approvedCount}</span>
          <span className={styles.statLabel}>Approved</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{pending.length}</span>
          <span className={styles.statLabel}>Pending</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{allRaces.length}</span>
          <span className={styles.statLabel}>Total Races</span>
        </div>
      </section>

      {/* ── Danh sách Approved ── */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.sectionTitle}>Danh sách Approved</h3>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Role</th>
                <th>Email</th>
                <th>Ngày duyệt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {approved.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    Chưa có thành viên nào được duyệt.
                  </td>
                </tr>
              ) : (
                approved.map((entry) => (
                  <tr key={entry.participantId}>
                    <td className={styles.horseName}>{entry.fullName}</td>
                    <td>{entry.role}</td>
                    <td>{entry.email}</td>
                    <td>{entry.approvedAt ? formatDate(entry.approvedAt) : '—'}</td>
                    <td>
                      <span className={styles.assignedBadge}>
                        <FiCheckCircle size={12} /> Approved
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Pending ── */}
      {pending.length > 0 && (
        <section className={styles.tableCard}>
          <h3 className={styles.sectionTitle}>Đang chờ duyệt</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Role</th>
                  <th>Ngày đăng ký</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((entry) => (
                  <tr key={entry.participantId}>
                    <td className={styles.horseName}>{entry.fullName}</td>
                    <td>{entry.role}</td>
                    <td>{formatDate(entry.registeredAt)}</td>
                    <td>
                      <span className={styles.waitingBadge}>Pending</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                    <FiCheckCircle size={14} /> {race.roundName} - Race {race.raceNumber} đủ {RACE_CAPACITY} người
                  </span>
                ) : (
                  <span className={styles.validWarn}>
                    <FiAlertTriangle size={14} /> {race.roundName} - Race {race.raceNumber} còn thiếu {race.missing} người
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