import { useState, useMemo, useEffect, useCallback } from 'react';
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { apiFetch } from '../../services/apiClient';
import styles from './UserManagement.module.scss';
import UserDetailModal from '../../components/common/UserDetailModal';

// ─── Types ───────────────────────────────────────────────────────────────────
type UserRole = 'Admin' | 'HorseOwner' |'Owner'| 'Jockey' | 'RaceReferee' |'Referee'| 'Doctor' | 'Spectator';
type UserStatus = 'Active' | 'Suspended' | 'Pending' | 'Rejected';

interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joinedDate: string;
}

interface ApiUser {
  userId: number;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Admin',
  Owner: 'Owner',
  HorseOwner: 'Owner',
  Jockey: 'Jockey',
  Referee: 'Referee',
  RaceReferee: 'Referee',
  Doctor: 'Doctor',
  Spectator: 'Spectator',
};

// Map role → approve endpoint
const APPROVE_ENDPOINT: Partial<Record<UserRole, string>> = {
  Jockey: '/admin/jockeys',
  Referee: '/admin/referees',   
  RaceReferee: '/admin/referees',
  Doctor: '/admin/doctors',
};

const PAGE_SIZE = 8;

const UserManagement = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [pendingAction, setPendingAction] = useState<{
    user: SystemUser;
    action: 'suspend' | 'activate' | 'approve';
  } | null>(null);

  // ─── Fetch users từ API ───────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; data: ApiUser[] }>('/admin/users');
      if (res.success && res.data) {
        const mapped: SystemUser[] = res.data.map((u) => ({
          id: String(u.userId),
          username: u.username,
          email: u.email,
          role: u.role as UserRole,
          status: u.status as UserStatus,
          joinedDate: new Date(u.createdAt).toLocaleDateString('vi-VN'),
        }));
        setUsers(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ─── Filter + search ──────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        searchQuery.trim() === '' ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // ─── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const resetToFirstPage = () => setCurrentPage(1);

  // ─── Confirm action ───────────────────────────────────────────────────────
const handleConfirmAction = async () => {
  if (!pendingAction) return;
  const { user, action } = pendingAction;

  try {
    if (action === 'approve') {
      const endpoint = APPROVE_ENDPOINT[user.role];
      if (!endpoint) return;
      await apiFetch(`${endpoint}/${user.id}/approve`, { method: 'PATCH' });
    } else {
      // suspend và activate đều gọi /suspend — BE tự toggle
      await apiFetch(`/admin/users/${user.id}/suspend`, { method: 'PATCH' });
    }
    await fetchUsers();
  } catch (err) {
    console.error('Action failed:', err);
  } finally {
    setPendingAction(null);
  }
};

  // ─── Columns ──────────────────────────────────────────────────────────────
  const columns: DataTableColumn<SystemUser>[] = [
    {
      key: 'username',
      header: 'Username',
      render: (row) => <span className={styles.usernameCell}>{row.username}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className={styles.emailCell}>{row.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <span className={styles.roleBadge}>{ROLE_LABELS[row.role] ?? row.role}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status as StatusType} />,
    },
    {
      key: 'joinedDate',
      header: 'Ngày tham gia',
      render: (row) => row.joinedDate,
    },
    {
      key: 'action',
      header: '',
      width: '240px',
      render: (row) => (
        <div className={styles.actionCell}>
          {row.status === 'Pending' && APPROVE_ENDPOINT[row.role] && (
            <button
              type="button"
              className={styles.approveBtn}
              onClick={() => setPendingAction({ user: row, action: 'approve' })}
            >
              Approve
            </button>
          )}
          {row.status === 'Active' && (
            <button
              type="button"
              className={styles.suspendBtn}
              onClick={() => setPendingAction({ user: row, action: 'suspend' })}
            >
              Suspend
            </button>
          )}
          {row.status === 'Suspended' && (
            <button
              type="button"
              className={styles.activateBtn}
              onClick={() => setPendingAction({ user: row, action: 'activate' })}
            >
              Activate
            </button>
          )}
<button type="button" className={styles.detailBtn} onClick={() => setDetailUser(row)}>
  Xem chi tiết
</button>
        </div>
      ),
    },
  ];

  const [detailUser, setDetailUser] = useState<SystemUser | null>(null);

  return (
    <div className={styles.container}>
      {/* ═══ HEADER ═══════════════════════════════════════════ */}
      <div className={styles.header}>
        <h1 className={styles.heading}>User Management</h1>
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <FiSearch className={styles.searchIcon} size={15} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Tìm theo username/email..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); resetToFirstPage(); }}
            />
          </div>
          <select
            className={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value as UserRole | 'all'); resetToFirstPage(); }}
          >
            <option value="all">Tất cả Role</option>
            <option value="Admin">Admin</option>
            <option value="HorseOwner">Owner</option>
            <option value="Jockey">Jockey</option>
            <option value="RaceReferee">Referee</option>
            <option value="Doctor">Doctor</option>
            <option value="Spectator">Spectator</option>
          </select>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as UserStatus | 'all'); resetToFirstPage(); }}
          >
            <option value="all">Tất cả Status</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* ═══ TABLE ════════════════════════════════════════════ */}
      {loading ? (
        <p className={styles.loadingText}>Đang tải danh sách người dùng...</p>
      ) : (
        <DataTable
          columns={columns}
          data={pagedUsers}
          rowKey={(row) => row.id}
          emptyMessage="Không tìm thấy người dùng phù hợp."
        />
      )}

      {/* ═══ PAGINATION ═══════════════════════════════════════ */}
      <div className={styles.pagination}>
        <span className={styles.pageInfo}>
          Trang {currentPage}/{totalPages} — {filteredUsers.length} người dùng
        </span>
        <div className={styles.pageBtns}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <FiChevronLeft size={16} /> Previous
          </button>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next <FiChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ═══ CONFIRM DIALOG ═══════════════════════════════════ */}
      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.action === 'approve' ? 'Phê duyệt tài khoản' :
            pendingAction.action === 'suspend' ? 'Suspend tài khoản' : 'Activate tài khoản'
          }
          message={`Bạn có chắc muốn ${
            pendingAction.action === 'approve' ? 'phê duyệt' :
            pendingAction.action === 'suspend' ? 'Suspend' : 'Activate'
          } tài khoản "${pendingAction.user.username}"?`}
          variant={pendingAction.action === 'suspend' ? 'danger' : 'default'}
          confirmLabel={
            pendingAction.action === 'approve' ? 'Approve' :
            pendingAction.action === 'suspend' ? 'Suspend' : 'Activate'
          }
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
      {detailUser && (
        <UserDetailModal
          userId={detailUser.id}
          role={detailUser.role}
          onClose={() => setDetailUser(null)}
        />
      )}
    </div>
  );
};



export default UserManagement;