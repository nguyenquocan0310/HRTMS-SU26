import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { FiChevronDown } from 'react-icons/fi';

import StatusBadge, {
  type StatusType,
} from '../../components/common/StatusBadge';

import DataTable, {
  type DataTableColumn,
} from '../../components/common/DataTable';

import UserDetailModal from '../../components/common/UserDetailModal';

import {
  approveParticipant,
  getRoster,
  rejectParticipant,
  type ParticipantResponse,
} from '../../services/participantService';

import {
  getTournaments,
} from '../../services/tournamentService';

import styles from './RosterApprovalTable.module.scss';

interface TournamentOption {
  id: number;
  name: string;
}

const formatDate = (
  iso: string | null | undefined
): string => {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('vi-VN');
};

const RosterApprovalTable = () => {
  const [
    tournaments,
    setTournaments,
  ] = useState<TournamentOption[]>([]);

  const [
    selectedTournamentId,
    setSelectedTournamentId,
  ] = useState<number | null>(null);

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('');

  const [
    roleFilter,
    setRoleFilter,
  ] = useState('');

  const [
    items,
    setItems,
  ] = useState<ParticipantResponse[]>([]);

  const [
    selectedItem,
    setSelectedItem,
  ] = useState<ParticipantResponse | null>(
    null
  );

  const [loading, setLoading] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  // ─── Load Tournament list ────────────────────────────────────────────────

  useEffect(() => {
    getTournaments()
      .then((list) => {
        const mapped: TournamentOption[] =
          list.map((tournament) => ({
            id: tournament.tournamentId,
            name: tournament.name,
          }));

        setTournaments(mapped);

        if (mapped.length > 0) {
          setSelectedTournamentId(
            mapped[0].id
          );
        }
      })
      .catch((err) => {
        setTournaments([]);

        setError(
          err instanceof Error
            ? err.message
            : 'Không tải được danh sách Tournament.'
        );
      });
  }, []);

  // ─── Load Tournament roster ──────────────────────────────────────────────

  const loadRoster =
    useCallback(async () => {
      if (!selectedTournamentId) {
        setItems([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await getRoster(
          selectedTournamentId,
          roleFilter || undefined,
          statusFilter || undefined
        );

        setItems(data);
      } catch (err) {
        setItems([]);

        setError(
          err instanceof Error
            ? err.message
            : 'Không tải được danh sách đăng ký Tournament.'
        );
      } finally {
        setLoading(false);
      }
    }, [
      selectedTournamentId,
      roleFilter,
      statusFilter,
    ]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // ─── Approve participant ─────────────────────────────────────────────────

  const handleApprove = async () => {
    if (
      !selectedItem ||
      actionLoading
    ) {
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const updated =
        await approveParticipant(
          selectedItem.participantId
        );

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.participantId ===
          selectedItem.participantId
            ? updated
            : item
        )
      );

      setSelectedItem(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Approve đăng ký Tournament thất bại.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Reject participant ──────────────────────────────────────────────────

  const handleReject = async () => {
    if (
      !selectedItem ||
      actionLoading
    ) {
      return;
    }

    const reason = window.prompt(
      'Nhập lý do từ chối đăng ký Tournament (tối thiểu 10 ký tự):'
    );

    if (reason === null) {
      return;
    }

    const trimmedReason =
      reason.trim();

    if (trimmedReason.length < 10) {
      setError(
        'Lý do từ chối phải có ít nhất 10 ký tự.'
      );

      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const updated =
        await rejectParticipant(
          selectedItem.participantId,
          trimmedReason
        );

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.participantId ===
          selectedItem.participantId
            ? updated
            : item
        )
      );

      setSelectedItem(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Reject đăng ký Tournament thất bại.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Table columns ───────────────────────────────────────────────────────

  const columns: DataTableColumn<ParticipantResponse>[] =
    [
      {
        key: 'fullName',
        header: 'Người đăng ký',
        render: (row) => (
          <span className={styles.name}>
            {row.fullName}
          </span>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        render: (row) =>
          row.email || '—',
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) =>
          row.role || '—',
      },
      {
        key: 'tournamentName',
        header: 'Tournament',
        render: (row) =>
          row.tournamentName || '—',
      },
      {
        key: 'registeredAt',
        header: 'Ngày đăng ký',
        render: (row) =>
          formatDate(row.registeredAt),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (row) => (
          <StatusBadge
            status={
              row.status as StatusType
            }
          />
        ),
      },
      {
        key: 'action',
        header: '',
        width: '140px',
        render: (row) => (
          <button
            type="button"
            className={styles.detailBtn}
            onClick={() => {
              setError('');
              setSelectedItem(row);
            }}
          >
            Xem chi tiết
          </button>
        ),
      },
    ];

  return (
    <div className={styles.wrap}>
      {/* Filters */}

      <div className={styles.filters}>
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={
              selectedTournamentId ?? ''
            }
            onChange={(event) => {
              const value = Number(
                event.target.value
              );

              setSelectedTournamentId(
                value || null
              );

              setSelectedItem(null);
            }}
          >
            {tournaments.length === 0 ? (
              <option value="">
                -- Chưa có Tournament --
              </option>
            ) : (
              tournaments.map(
                (tournament) => (
                  <option
                    key={tournament.id}
                    value={tournament.id}
                  >
                    {tournament.name}
                  </option>
                )
              )
            )}
          </select>

          <FiChevronDown
            className={styles.selectIcon}
            size={14}
          />
        </div>

        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(
                event.target.value
              );

              setSelectedItem(null);
            }}
          >
            <option value="">
              Tất cả trạng thái
            </option>

            <option value="Pending">
              Pending
            </option>

            <option value="Approved">
              Approved
            </option>

            <option value="Rejected">
              Rejected
            </option>
          </select>

          <FiChevronDown
            className={styles.selectIcon}
            size={14}
          />
        </div>

        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(
                event.target.value
              );

              setSelectedItem(null);
            }}
          >
            <option value="">
              Tất cả role
            </option>

            <option value="Owner">
              Owner
            </option>

            <option value="Jockey">
              Jockey
            </option>

            <option value="Referee">
              Referee
            </option>

            <option value="Doctor">
              Doctor
            </option>
          </select>

          <FiChevronDown
            className={styles.selectIcon}
            size={14}
          />
        </div>
      </div>

      {error && (
        <div className={styles.errorBox}>
          {error}
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>
          Đang tải danh sách đăng ký...
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          rowKey={(row) =>
            row.participantId
          }
          emptyMessage="Không có đăng ký Tournament nào phù hợp."
        />
      )}

      {/* View Detail giống trang Users.
          userId dùng để xem hồ sơ/certificate.
          participantId chỉ dùng approve/reject roster. */}

      {selectedItem && (
        <UserDetailModal
          userId={String(
            selectedItem.userId
          )}
          role={selectedItem.role}
          basicInfo={{
            username:
              selectedItem.email.split(
                '@'
              )[0] || '—',
            'Full Name':
              selectedItem.fullName,
            email:
              selectedItem.email,
            role:
              selectedItem.role,
            status:
              selectedItem.status,
            joinedDate:
              formatDate(
                selectedItem.registeredAt
              ),
            Tournament:
              selectedItem.tournamentName ??
              '—',
          }}
          showActions={
            selectedItem.status ===
              'Pending' &&
            !actionLoading
          }
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() =>
            setSelectedItem(null)
          }
        />
      )}
    </div>
  );
};

export default RosterApprovalTable;