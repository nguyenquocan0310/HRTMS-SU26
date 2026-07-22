import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle } from 'react-icons/fi';
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

  if (isNewDraft) {
    return (
      <div className={styles.notice}>
        Lưu giải đấu trước khi xem danh sách người tham gia. Danh sách chỉ có sau khi hệ thống tạo mã giải thật.
      </div>
    );
  }

  return (
    <div className={styles.rosterTab}>
      {/* ── Tổng quan ── */}
      <section className={styles.overviewCard}>
        <h3 className={styles.sectionTitle}>Tổng quan giải đấu</h3>
        <div className={styles.overviewGrid}>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Tên giải đấu</span>
            <strong className={styles.overviewValue}>{tournamentName || '—'}</strong>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Đăng ký</span>
            <strong className={styles.overviewValue}>Theo trạng thái giải</strong>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Đã duyệt</span>
            <strong className={styles.overviewValue}>{approvedCount}</strong>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Tổng số vòng</span>
            <strong className={styles.overviewValue}>{rounds.length}</strong>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Tổng số cuộc đua</span>
            <strong className={styles.overviewValue}>{allRaces.length}</strong>
          </div>
        </div>
      </section>

      {error && <div className={styles.errorBox}>{error}</div>}
      {loading && <p className={styles.loadingText}>Đang tải danh sách người tham gia...</p>}

      {/* ── Stats ── */}
      <section className={styles.statsRow}>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{totalRegistered}</span>
          <span className={styles.statLabel}>Tổng số đăng ký</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{approvedCount}</span>
          <span className={styles.statLabel}>Đã duyệt</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{pending.length}</span>
          <span className={styles.statLabel}>Đang chờ</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statValue}>{allRaces.length}</span>
          <span className={styles.statLabel}>Tổng số cuộc đua</span>
        </div>
      </section>

      {/* ── Danh sách Approved ── */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.sectionTitle}>Danh sách đã duyệt</h3>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Vai trò</th>
                <th>Email</th>
                <th>Ngày duyệt</th>
                <th>Trạng thái</th>
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
                        <FiCheckCircle size={12} /> Đã duyệt
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
                  <th>Vai trò</th>
                  <th>Ngày đăng ký</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((entry) => (
                  <tr key={entry.participantId}>
                    <td className={styles.horseName}>{entry.fullName}</td>
                    <td>{entry.role}</td>
                    <td>{formatDate(entry.registeredAt)}</td>
                    <td>
                      <span className={styles.waitingBadge}>Đang chờ</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Phân cuộc đua dùng kết quả API ở màn điều hành, không suy đoán từ roster. */}
      <section className={styles.validationCard}>
        <h3 className={styles.sectionTitle}>Lưu ý điều hành</h3>
        <ul className={styles.validationList}>
          <li className={styles.validationItem}><span className={styles.validationMuted}>Việc xét cặp đủ điều kiện, phân cuộc đua và danh sách chờ được thực hiện tại mục Phân cuộc đua theo dữ liệu hệ thống.</span></li>
        </ul>
      </section>
    </div>
  );
};

export default TabRoster;
