import { useEffect, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiChevronDown } from 'react-icons/fi';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import {
  getRoster,
  approveParticipant,
  rejectParticipant,
  type ParticipantResponse,
} from '../../services/participantService';
import { getTournaments } from '../../services/tournamentService';
import styles from './RosterApprovalTable.module.scss';

const formatDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN') : '—';

const RosterApprovalTable = () => {
  const [tournaments, setTournaments] = useState<{ id: number; name: string }[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [items, setItems] = useState<ParticipantResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedItem, setSelectedItem] = useState<ParticipantResponse | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Load danh sách tournament để chọn
  useEffect(() => {
    getTournaments()
      .then((list) => {
        const mapped = list.map((t) => ({ id: t.tournamentId, name: t.name }));
        setTournaments(mapped);
        if (mapped.length > 0) setSelectedTournamentId(mapped[0].id);
      })
      .catch(() => {});
  }, []);

  // Load roster khi tournament/filter thay đổi
  useEffect(() => {
    if (!selectedTournamentId) return;
    setLoading(true);
    setError('');
    getRoster(selectedTournamentId, roleFilter || undefined, statusFilter || undefined)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedTournamentId, statusFilter, roleFilter]);

  const handleApprove = async (item: ParticipantResponse) => {
    setActionLoading(true);
    setActionError('');
    try {
      await approveParticipant(item.participantId);
      setSelectedItem(null);
      // Reload
      if (selectedTournamentId) {
        const updated = await getRoster(selectedTournamentId, roleFilter || undefined, statusFilter || undefined);
        setItems(updated);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Approve thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    if (rejectReason.trim().length < 10) {
      setActionError('Lý do từ chối phải có ít nhất 10 ký tự.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      await rejectParticipant(selectedItem.participantId, rejectReason.trim());
      setSelectedItem(null);
      setRejectReason('');
      if (selectedTournamentId) {
        const updated = await getRoster(selectedTournamentId, roleFilter || undefined, statusFilter || undefined);
        setItems(updated);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Reject thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  const columns: DataTableColumn<ParticipantResponse>[] = [
    { key: 'fullName', header: 'Người đăng ký', render: (r) => <span className={styles.name}>{r.fullName}</span> },
    { key: 'role', header: 'Role', render: (r) => r.role },
    { key: 'tournamentName', header: 'Tournament', render: (r) => r.tournamentName ?? '—' },
    { key: 'registeredAt', header: 'Ngày nộp', render: (r) => formatDate(r.registeredAt) },
    { key: 'status', header: 'Trạng thái', render: (r) => <StatusBadge status={r.status as StatusType} /> },
    {
      key: 'action',
      header: '',
      width: '140px',
      render: (r) => (
        <button
          type="button"
          className={styles.detailBtn}
          onClick={() => { setSelectedItem(r); setRejectReason(''); setActionError(''); }}
        >
          Xem chi tiết
        </button>
      ),
    },
  ];

  return (
    <div className={styles.wrap}>
      {/* ── Filters ── */}
      <div className={styles.filters}>
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={selectedTournamentId ?? ''}
            onChange={(e) => setSelectedTournamentId(Number(e.target.value))}
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <FiChevronDown className={styles.selectIcon} size={14} />
        </div>

        <div className={styles.selectWrap}>
          <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <FiChevronDown className={styles.selectIcon} size={14} />
        </div>

        <div className={styles.selectWrap}>
          <select className={styles.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Tất cả role</option>
            <option value="Owner">Owner</option>
            <option value="Jockey">Jockey</option>
            <option value="Referee">Referee</option>
            <option value="Doctor">Doctor</option>
          </select>
          <FiChevronDown className={styles.selectIcon} size={14} />
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {loading ? (
        <p className={styles.loading}>Đang tải...</p>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          rowKey={(r) => r.participantId}
          emptyMessage="Không có đăng ký nào."
        />
      )}

      {/* ── Detail panel ── */}
      {selectedItem && (
        <>
          <div className={styles.overlay} onClick={() => setSelectedItem(null)} />
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>Chi tiết đăng ký</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setSelectedItem(null)}>✕</button>
            </div>

            <div className={styles.panelSection}>
              <h4 className={styles.sectionLabel}>Thông tin Tournament</h4>
              <div className={styles.infoRow}><span>Tournament</span><strong>{selectedItem.tournamentName ?? '—'}</strong></div>
              <div className={styles.infoRow}><span>Ngày đăng ký</span><strong>{formatDate(selectedItem.registeredAt)}</strong></div>
            </div>

            <div className={styles.panelSection}>
              <h4 className={styles.sectionLabel}>Thông tin người dùng</h4>
              <div className={styles.infoRow}><span>Họ tên</span><strong>{selectedItem.fullName}</strong></div>
              <div className={styles.infoRow}><span>Email</span><strong>{selectedItem.email}</strong></div>
              <div className={styles.infoRow}><span>Role</span><strong>{selectedItem.role}</strong></div>
            </div>

            <div className={styles.panelSection}>
              <h4 className={styles.sectionLabel}>Trạng thái đăng ký</h4>
              <div className={styles.infoRow}><span>Status</span><StatusBadge status={selectedItem.status as StatusType} /></div>
              {selectedItem.rejectionReason && (
                <div className={styles.infoRow}><span>Lý do từ chối</span><strong>{selectedItem.rejectionReason}</strong></div>
              )}
            </div>

            {selectedItem.status === 'Pending' && (
              <div className={styles.panelActions}>
                {actionError && <div className={styles.errorBox}>{actionError}</div>}

                <textarea
                  className={styles.rejectTextarea}
                  placeholder="Lý do từ chối (ít nhất 10 ký tự)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />

                <div className={styles.actionBtns}>
                  <button
                    type="button"
                    className={styles.rejectBtn}
                    onClick={handleReject}
                    disabled={actionLoading}
                  >
                    <FiXCircle size={14} /> Reject
                  </button>
                  <button
                    type="button"
                    className={styles.approveBtn}
                    onClick={() => handleApprove(selectedItem)}
                    disabled={actionLoading}
                  >
                    <FiCheckCircle size={14} /> Approve
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RosterApprovalTable;