import { useState, useMemo } from 'react';
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import styles from './UserManagement.module.scss';

// ─── Types ──────────────────────────────────────────────────────────────────
type UserRole = 'Admin' | 'HorseOwner' | 'Jockey' | 'RaceReferee' | 'Doctor' | 'Spectator';
type UserStatus = 'Active' | 'Suspended' | 'Pending' | 'Rejected';

interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joinedDate: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Admin',
  HorseOwner: 'Owner',
  Jockey: 'Jockey',
  RaceReferee: 'Referee',
  Doctor: 'Doctor',
  Spectator: 'Spectator',
};

// ─── Mock data — TODO: thay bằng API thật khi có Swagger (Điều 6) ──────────
// Dự kiến: GET /api/admin/users?role=&status=&search=&page=
const MOCK_USERS: SystemUser[] = [
  { id: 'u1', username: 'thomas_owner', email: 'thomas@hrtms.com', role: 'HorseOwner', status: 'Active', joinedDate: '12/01/2026' },
  { id: 'u2', username: 'jockey_hung', email: 'hung.tran@hrtms.com', role: 'Jockey', status: 'Active', joinedDate: '15/01/2026' },
  { id: 'u3', username: 'ref_lan', email: 'lan.pham@hrtms.com', role: 'RaceReferee', status: 'Suspended', joinedDate: '20/01/2026' },
  { id: 'u4', username: 'dr_huy', email: 'huy.do@hrtms.com', role: 'Doctor', status: 'Active', joinedDate: '02/02/2026' },
  { id: 'u5', username: 'spectator_an', email: 'an.nguyen@hrtms.com', role: 'Spectator', status: 'Active', joinedDate: '08/02/2026' },
  { id: 'u6', username: 'owner_royal', email: 'royal.stable@hrtms.com', role: 'HorseOwner', status: 'Suspended', joinedDate: '14/02/2026' },
  { id: 'u7', username: 'jockey_khoi', email: 'khoi.le@hrtms.com', role: 'Jockey', status: 'Pending', joinedDate: '01/03/2026' },
  { id: 'u8', username: 'admin_root', email: 'admin@hrtms.com', role: 'Admin', status: 'Active', joinedDate: '01/01/2026' },
  { id: 'u9', username: 'spectator_mai', email: 'mai.vu@hrtms.com', role: 'Spectator', status: 'Rejected', joinedDate: '10/03/2026' },
  { id: 'u10', username: 'jockey_son', email: 'son.bui@hrtms.com', role: 'Jockey', status: 'Active', joinedDate: '18/03/2026' },
  { id: 'u11', username: 'owner_meydan', email: 'meydan.stable@hrtms.com', role: 'HorseOwner', status: 'Active', joinedDate: '22/03/2026' },
  { id: 'u12', username: 'ref_tuan', email: 'tuan.hoang@hrtms.com', role: 'RaceReferee', status: 'Active', joinedDate: '25/03/2026' },
];

const PAGE_SIZE = 8;

const UserManagement = () => {
  const [users, setUsers] = useState<SystemUser[]>(MOCK_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [pendingAction, setPendingAction] = useState<{
    user: SystemUser;
    action: 'suspend' | 'activate';
  } | null>(null);

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

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    const newStatus: UserStatus = pendingAction.action === 'suspend' ? 'Suspended' : 'Active';

    // TODO: gọi API thật khi có Swagger — PATCH /api/admin/users/:id/status
    setUsers((prev) =>
      prev.map((u) => (u.id === pendingAction.user.id ? { ...u, status: newStatus } : u))
    );
    setPendingAction(null);
  };

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
      render: (row) => <span className={styles.roleBadge}>{ROLE_LABELS[row.role]}</span>,
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
      width: '220px',
      render: (row) => (
        <div className={styles.actionCell}>
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
          <button type="button" className={styles.detailBtn}>
            Xem chi tiết
          </button>
        </div>
      ),
    },
  ];

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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetToFirstPage();
              }}
            />
          </div>

          <select
            className={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as UserRole | 'all');
              resetToFirstPage();
            }}
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
            onChange={(e) => {
              setStatusFilter(e.target.value as UserStatus | 'all');
              resetToFirstPage();
            }}
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
      <DataTable
        columns={columns}
        data={pagedUsers}
        rowKey={(row) => row.id}
        emptyMessage="Không tìm thấy người dùng phù hợp."
      />

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
          title={pendingAction.action === 'suspend' ? 'Suspend tài khoản' : 'Activate tài khoản'}
          message={`Bạn có chắc muốn ${
            pendingAction.action === 'suspend' ? 'Suspend' : 'Activate'
          } tài khoản "${pendingAction.user.username}"?`}
          variant={pendingAction.action === 'suspend' ? 'danger' : 'default'}
          confirmLabel={pendingAction.action === 'suspend' ? 'Suspend' : 'Activate'}
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
};

export default UserManagement;