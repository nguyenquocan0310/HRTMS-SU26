import { useEffect, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiCheck } from 'react-icons/fi';
import { apiFetch } from '../../services/apiClient';
import styles from './EntryFees.module.scss';

interface FeeEntry {
  raceEntryId: number;
  raceId: number;
  horseName: string;
  jockey?: {
    fullName?: string;
  };
  status: string;
  entryFeeStatus: string;
  createdAt: string;
}

interface RejectModalState {
  entryId: number;
  reason: string;
}

const EntryFees = () => {
  const [entries, setEntries] = useState<FeeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<RejectModalState | null>(null);

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
    setActionId(id);
    setMsg(''); setError('');
    try {
      await apiFetch(`/admin/entries/${id}/fee-status`, { method: 'PATCH' });
      setMsg(`Entry #${id} đã xác nhận phí thành công.`);
      loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xác nhận phí thất bại.');
    } finally { setActionId(null); }
  };

  const handleApprove = async (id: number) => {
    setActionId(id);
    setMsg(''); setError('');
    try {
      await apiFetch(`/admin/entries/${id}/approve`, { method: 'PATCH' });
      setMsg(`Entry #${id} đã được approve.`);
      loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve thất bại.');
    } finally { setActionId(null); }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal || rejectModal.reason.trim().length < 10) return;
    setActionId(rejectModal.entryId);
    setMsg(''); setError('');
    try {
      await apiFetch(`/admin/entries/${rejectModal.entryId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectModal.reason.trim() }),
      });
      setMsg(`Entry #${rejectModal.entryId} đã bị reject.`);
      setRejectModal(null);
      loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject thất bại.');
    } finally { setActionId(null); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Entry Fee Management</h2>
        <p className={styles.sectionDesc}>Xác nhận lệ phí thủ công, approve hoặc reject entry tham gia race.</p>
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
                    <td className={styles.name}>
                      {entry.horseName} <span className={styles.muted}>#{entry.raceEntryId}</span>
                    </td>
                    <td>{entry.jockey?.fullName ?? '—'}</td>
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
                      <div className={styles.actionBtns}>
                        {/* Gộp Fee/Approve thành 1 nút duy nhất theo trạng thái —
                            BE yêu cầu EntryFeeStatus="Paid" mới cho Approve, nên
                            không hiện Approve trước khi Fee đã xác nhận, tránh
                            luôn báo lỗi khi bấm nhầm thứ tự. */}
                        {entry.entryFeeStatus !== 'Paid' ? (
                          <button
                            type="button"
                            className={styles.feeBtn}
                            onClick={() => handleConfirmFee(entry.raceEntryId)}
                            disabled={actionId === entry.raceEntryId}
                            title="Xác nhận đã thu phí"
                          >
                            <FiCheck size={13} /> Fee
                          </button>
                        ) : entry.status === 'Pending' ? (
                          <button
                            type="button"
                            className={styles.approveBtn}
                            onClick={() => handleApprove(entry.raceEntryId)}
                            disabled={actionId === entry.raceEntryId}
                            title="Approve entry vào race"
                          >
                            <FiCheckCircle size={13} /> Approve
                          </button>
                        ) : (
                          <span className={styles.muted}>Đã xử lý</span>
                        )}
                        {/* Reject Entry */}
                        {/* Reject Entry */}
                        <button
                          type="button"
                          className={styles.rejectBtn}
                          onClick={() => setRejectModal({ entryId: entry.raceEntryId, reason: '' })}
                          disabled={actionId === entry.raceEntryId}
                          title="Reject entry"
                        >
                          <FiXCircle size={13} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <>
          <div className={styles.overlay} onClick={() => setRejectModal(null)} />
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Lý do reject Entry #{rejectModal.entryId}</h3>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder="Nhập lý do từ chối (tối thiểu 10 ký tự)..."
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
            />
            {rejectModal.reason.length > 0 && rejectModal.reason.trim().length < 10 && (
              <p className={styles.errorMsg}>Cần ít nhất 10 ký tự.</p>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setRejectModal(null)}>Hủy</button>
              <button
                type="button"
                className={styles.rejectConfirmBtn}
                onClick={handleRejectConfirm}
                disabled={rejectModal.reason.trim().length < 10 || actionId !== null}
              >
                Xác nhận reject
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EntryFees;
