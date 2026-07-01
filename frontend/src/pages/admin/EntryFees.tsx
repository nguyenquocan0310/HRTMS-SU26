import { useEffect, useState } from 'react';
import { FiCheckCircle } from 'react-icons/fi';
import { apiFetch } from '../../services/apiClient';
import styles from './EntryFees.module.scss';

interface FeeEntry {
  raceEntryId: number;
  raceId: number;
  horseName: string;
  jockeyName: string;
  status: string;
  entryFeeStatus: string;
  createdAt: string;
}

const EntryFees = () => {
  const [entries, setEntries] = useState<FeeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const loadEntries = () => {
    setLoading(true);
    setError('');
    apiFetch<{ success: boolean; data: FeeEntry[] }>('/admin/entries/pending-fee')
      .then((res) => setEntries(res.data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEntries(); }, []);

  const handleConfirmFee = async (id: number) => {
    setConfirmingId(id);
    setMsg('');
    setError('');
    try {
      await apiFetch(`/admin/entries/${id}/fee-status`, { method: 'PATCH' });
      setMsg(`Entry #${id} đã xác nhận phí thành công.`);
      loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xác nhận phí thất bại.');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Entry Fee Management</h2>
        <p className={styles.sectionDesc}>Xác nhận lệ phí thủ công và khóa approve khi entry chưa Paid.</p>
      </div>

      {msg && <p className={styles.successMsg}>{msg}</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.tableCard}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Entry</th>
                <th>Jockey</th>
                <th>Entry Status</th>
                <th>Fee Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className={styles.emptyCell}>Đang tải...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={5} className={styles.emptyCell}>Không có entry nào đang chờ xử lý phí.</td></tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.raceEntryId}>
                    <td className={styles.name}>{entry.horseName} <span className={styles.muted}>#{entry.raceEntryId}</span></td>
                    <td>{entry.jockeyName}</td>
                    <td>
                      <span className={`${styles.badge} ${entry.status === 'Confirmed' ? styles.confirmed : styles.pending}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${entry.entryFeeStatus === 'Paid' ? styles.confirmed : styles.unpaid}`}>
                        {entry.entryFeeStatus}
                      </span>
                    </td>
                    <td>
                      {entry.entryFeeStatus !== 'Paid' && (
                        <button
                          type="button"
                          className={styles.confirmBtn}
                          onClick={() => handleConfirmFee(entry.raceEntryId)}
                          disabled={confirmingId === entry.raceEntryId}
                        >
                          <FiCheckCircle size={13} />
                          {confirmingId === entry.raceEntryId ? 'Đang xử lý...' : 'Confirm Fee'}
                        </button>
                      )}
                    </td>
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

export default EntryFees;