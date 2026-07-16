import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  FiActivity,
  FiFlag,
} from 'react-icons/fi';

import DataTable, {
  type DataTableColumn,
} from '../../components/common/DataTable';

import StatusBadge, {
  type StatusType,
} from '../../components/common/StatusBadge';

import UserDetailModal from '../../components/common/UserDetailModal';
import ApprovalDetailPanel from './ApprovalDetailPanel';

import {
  approveParticipant,
  getRoster,
  rejectParticipant,
  type ParticipantResponse,
} from '../../services/participantService';

import {
  getTournaments,
} from '../../services/tournamentService';

import {
  approveDoctor,
  approveJockey,
  approveReferee,
  getPendingApprovals,
  getPendingHorses,
  rejectDoctor,
  rejectJockey,
  rejectReferee,
  type HorseEnrollmentPending,
  type PersonPending,
} from '../../services/approvalService';

import styles from './ApprovalCenter.module.scss';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ApprovalGroup =
  | 'registration'
  | 'horse';

export interface HorseApproval {
  id: string;

  // enrollmentId: dùng cho approve/reject Horse Enrollment.
  entityId: number;

  // horseId: dùng cho GET /admin/horses/{horseId}.
  horseId: number;

  type: 'horse';
  subject: string;
  submittedDate: string;
  stable: string;
  status: StatusType;

  breed: string;
  allowedBreed: string;

  dopingTestResult:
    | 'Passed'
    | 'Failed'
    | 'Pending'
    | string;

  vaccinationRecordRef: string;

  entryFeeStatus:
    | 'Paid'
    | 'Unpaid';
}

export interface PersonnelApproval {
  id: string;

  // userId: dùng xem detail/certificate và approve/reject personnel.
  entityId: number;

  type: 'personnel';

  subject: string;
  username: string;
  email: string;

  role:
    | 'Jockey'
    | 'Referee'
    | 'Doctor';

  submittedDate: string;
  status: StatusType;
}

export type ApprovalItem =
  | HorseApproval
  | PersonnelApproval;

interface CombinedRegistrationRow {
  id: string;

  /**
   * profile: hồ sơ tài khoản Jockey/Referee/Doctor.
   * tournament: lượt đăng ký tham gia Tournament.
   */
  source: 'profile' | 'tournament';

  userId: number;
  participantId?: number;

  fullName: string;
  username: string;
  email: string;
  role: string;
  tournamentName: string;

  submittedDate: string;
  status: StatusType;
}

interface TournamentOption {
  id: number;
  name: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GROUPS: Array<{
  key: ApprovalGroup;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'registration',
    title: 'Đăng ký vào giải',
    description:
      'Jockey, Trọng tài, Bác sĩ và Tournament Roster',
    icon: <FiFlag size={18} />,
  },
  {
    key: 'horse',
    title: 'Hồ sơ ngựa',
    description:
      'Sức khỏe và định danh ngựa',
    icon: <FiActivity size={18} />,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

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

const normalizeStatus = (
  status: string
): StatusType => {
  return status as StatusType;
};

const mapHorse = (
  horse: HorseEnrollmentPending
): HorseApproval => ({
  id: `horse-${horse.enrollmentId}`,
  entityId: horse.enrollmentId,
  horseId: horse.horseId,
  type: 'horse',
  subject: horse.horseName,
  submittedDate: formatDate(
    horse.createdAt
  ),
  stable:
    horse.tournamentName || '—',
  status: normalizeStatus(
    horse.adminApprovalStatus
  ),

  // Chi tiết đầy đủ được tải riêng trong ApprovalDetailPanel.
  breed: '',
  allowedBreed: '',
  dopingTestResult: 'Pending',
  vaccinationRecordRef: '',
  entryFeeStatus: 'Paid',
});

const mapPersonnel = (
  person: PersonPending,
  role: PersonnelApproval['role']
): PersonnelApproval => ({
  id: `${role.toLowerCase()}-${person.userId}`,
  entityId: person.userId,
  type: 'personnel',
  subject: person.fullName,
  username: person.username,
  email: person.email,
  role,
  submittedDate: formatDate(
    person.createdAt
  ),
  status: normalizeStatus(
    person.profileStatus
  ),
});

// ─── Component ──────────────────────────────────────────────────────────────

const ApprovalCenter = () => {
  const [activeGroup, setActiveGroup] =
    useState<ApprovalGroup>(
      'registration'
    );

  const [
    personnelItems,
    setPersonnelItems,
  ] =
    useState<PersonnelApproval[]>([]);

  const [
    rosterItems,
    setRosterItems,
  ] =
    useState<ParticipantResponse[]>([]);

  const [
    horseItems,
    setHorseItems,
  ] =
    useState<HorseApproval[]>([]);

  const [
    tournaments,
    setTournaments,
  ] =
    useState<TournamentOption[]>([]);

  const [
    selectedTournamentId,
    setSelectedTournamentId,
  ] =
    useState<number | null>(null);

  const [
    selectedRegistration,
    setSelectedRegistration,
  ] =
    useState<CombinedRegistrationRow | null>(
      null
    );

  const [
    selectedHorse,
    setSelectedHorse,
  ] =
    useState<HorseApproval | null>(
      null
    );

  const [statusFilter, setStatusFilter] =
    useState('');

  const [roleFilter, setRoleFilter] =
    useState('');

  const [
    registrationLoading,
    setRegistrationLoading,
  ] =
    useState(false);

  const [
    horseLoading,
    setHorseLoading,
  ] =
    useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState(false);

  const [error, setError] =
    useState('');

  // ─── Load personnel ──────────────────────────────────────────────────────

  const loadPersonnel =
    useCallback(async () => {
      try {
        const {
          jockeys,
          referees,
          doctors,
        } =
          await getPendingApprovals();

        const mapped: PersonnelApproval[] =
          [
            ...jockeys.map((item) =>
              mapPersonnel(
                item,
                'Jockey'
              )
            ),

            ...referees.map((item) =>
              mapPersonnel(
                item,
                'Referee'
              )
            ),

            ...doctors.map((item) =>
              mapPersonnel(
                item,
                'Doctor'
              )
            ),
          ];

        setPersonnelItems(mapped);
      } catch (err) {
        setPersonnelItems([]);

        throw err;
      }
    }, []);

  // ─── Load Tournament list ────────────────────────────────────────────────

  const loadTournaments =
    useCallback(async () => {
      try {
        const list =
          await getTournaments();

        const mapped: TournamentOption[] =
          list.map((tournament) => ({
            id: tournament.tournamentId,
            name: tournament.name,
          }));

        setTournaments(mapped);

        setSelectedTournamentId(
          (currentId) => {
            if (
              currentId &&
              mapped.some(
                (item) =>
                  item.id === currentId
              )
            ) {
              return currentId;
            }

            return mapped.length > 0
              ? mapped[0].id
              : null;
          }
        );
      } catch (err) {
        setTournaments([]);

        throw err;
      }
    }, []);

  // ─── Load Tournament roster ──────────────────────────────────────────────

  const loadRoster =
    useCallback(async () => {
      if (!selectedTournamentId) {
        setRosterItems([]);
        return;
      }

      try {
        const data = await getRoster(
          selectedTournamentId
        );

        setRosterItems(data);
      } catch (err) {
        setRosterItems([]);

        throw err;
      }
    }, [selectedTournamentId]);

  // ─── Load combined registration section ─────────────────────────────────

  const loadRegistrationData =
    useCallback(async () => {
      setRegistrationLoading(true);
      setError('');

      try {
        await Promise.all([
          loadPersonnel(),
          loadTournaments(),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Không tải được dữ liệu đăng ký.'
        );
      } finally {
        setRegistrationLoading(false);
      }
    }, [
      loadPersonnel,
      loadTournaments,
    ]);

  // ─── Load horses ─────────────────────────────────────────────────────────

  const loadHorses =
    useCallback(async () => {
      setHorseLoading(true);
      setError('');

      try {
        const horses =
          await getPendingHorses();

        setHorseItems(
          horses.map(mapHorse)
        );
      } catch (err) {
        setHorseItems([]);

        setError(
          err instanceof Error
            ? err.message
            : 'Không tải được danh sách hồ sơ ngựa.'
        );
      } finally {
        setHorseLoading(false);
      }
    }, []);

  useEffect(() => {
    if (activeGroup === 'horse') {
      loadHorses();
      return;
    }

    loadRegistrationData();
  }, [
    activeGroup,
    loadHorses,
    loadRegistrationData,
  ]);

  useEffect(() => {
    if (
      activeGroup !== 'registration' ||
      !selectedTournamentId
    ) {
      return;
    }

    setRegistrationLoading(true);
    setError('');

    loadRoster()
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Không tải được danh sách đăng ký Tournament.'
        );
      })
      .finally(() => {
        setRegistrationLoading(false);
      });
  }, [
    activeGroup,
    selectedTournamentId,
    loadRoster,
  ]);

  // ─── Merge personnel + roster thành một bảng duy nhất ───────────────────

  const combinedRegistrationRows =
    useMemo<CombinedRegistrationRow[]>(() => {
      const profileRows: CombinedRegistrationRow[] =
        personnelItems.map((item) => ({
          id: `profile-${item.entityId}`,
          source: 'profile',

          userId: item.entityId,

          fullName: item.subject,
          username: item.username,
          email: item.email,
          role: item.role,

          // Hồ sơ tài khoản chưa gắn Tournament cụ thể.
          tournamentName: '—',

          submittedDate:
            item.submittedDate,

          status: item.status,
        }));

      const tournamentRows: CombinedRegistrationRow[] =
        rosterItems.map((item) => ({
          id: `tournament-${item.participantId}`,
          source: 'tournament',

          userId: item.userId,
          participantId:
            item.participantId,

          fullName: item.fullName,
          username:
            item.email.split('@')[0] ||
            '—',
          email: item.email,
          role: item.role,

          tournamentName:
            item.tournamentName ?? '—',

          submittedDate:
            formatDate(
              item.registeredAt
            ),

          status:
            item.status as StatusType,
        }));

      return [
        ...profileRows,
        ...tournamentRows,
      ].filter((row) => {
        const matchRole =
          !roleFilter ||
          row.role === roleFilter;

        const matchStatus =
          !statusFilter ||
          String(row.status) ===
            statusFilter;

        return (
          matchRole &&
          matchStatus
        );
      });
    }, [
      personnelItems,
      rosterItems,
      roleFilter,
      statusFilter,
    ]);

  // ─── Approve / Reject dòng đang chọn ────────────────────────────────────

  const handleApproveRegistration =
    async () => {
      if (
        !selectedRegistration ||
        actionLoading
      ) {
        return;
      }

      setActionLoading(true);
      setError('');

      try {
        if (
          selectedRegistration.source ===
          'tournament'
        ) {
          if (
            selectedRegistration.participantId ===
            undefined
          ) {
            throw new Error(
              'Không tìm thấy Participant ID.'
            );
          }

          await approveParticipant(
            selectedRegistration.participantId
          );
        } else if (
          selectedRegistration.role ===
          'Jockey'
        ) {
          await approveJockey(
            selectedRegistration.userId
          );
        } else if (
          selectedRegistration.role ===
          'Referee' ||
          selectedRegistration.role ===
          'RaceReferee'
        ) {
          await approveReferee(
            selectedRegistration.userId
          );
        } else if (
          selectedRegistration.role ===
          'Doctor'
        ) {
          await approveDoctor(
            selectedRegistration.userId
          );
        }

        setSelectedRegistration(null);

        await Promise.all([
          loadPersonnel(),
          loadRoster(),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Duyệt hồ sơ thất bại.'
        );
      } finally {
        setActionLoading(false);
      }
    };

  const handleRejectRegistration =
    async () => {
      if (
        !selectedRegistration ||
        actionLoading
      ) {
        return;
      }

      const reason = window.prompt(
        'Nhập lý do từ chối, tối thiểu 10 ký tự:'
      );

      if (reason === null) {
        return;
      }

      const trimmedReason =
        reason.trim();

      if (
        trimmedReason.length < 10
      ) {
        setError(
          'Lý do từ chối phải có ít nhất 10 ký tự.'
        );

        return;
      }

      setActionLoading(true);
      setError('');

      try {
        if (
          selectedRegistration.source ===
          'tournament'
        ) {
          if (
            selectedRegistration.participantId ===
            undefined
          ) {
            throw new Error(
              'Không tìm thấy Participant ID.'
            );
          }

          await rejectParticipant(
            selectedRegistration.participantId,
            trimmedReason
          );
        } else if (
          selectedRegistration.role ===
          'Jockey'
        ) {
          await rejectJockey(
            selectedRegistration.userId,
            trimmedReason
          );
        } else if (
          selectedRegistration.role ===
            'Referee' ||
          selectedRegistration.role ===
            'RaceReferee'
        ) {
          await rejectReferee(
            selectedRegistration.userId,
            trimmedReason
          );
        } else if (
          selectedRegistration.role ===
          'Doctor'
        ) {
          await rejectDoctor(
            selectedRegistration.userId,
            trimmedReason
          );
        }

        setSelectedRegistration(null);

        await Promise.all([
          loadPersonnel(),
          loadRoster(),
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Từ chối hồ sơ thất bại.'
        );
      } finally {
        setActionLoading(false);
      }
    };

  // ─── Combined registration table ─────────────────────────────────────────

  const registrationColumns: DataTableColumn<CombinedRegistrationRow>[] =
    [
      {
        key: 'fullName',
        header: 'Người đăng ký',
        render: (row) => (
          <span
            className={
              styles.subjectCell
            }
          >
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
          row.tournamentName ||
          '—',
      },
      {
        key: 'submittedDate',
        header: 'Ngày nộp',
        render: (row) =>
          row.submittedDate,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (row) => (
          <StatusBadge
            status={row.status}
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
            className={
              styles.detailBtn
            }
            onClick={() => {
              setError('');
              setSelectedRegistration(
                row
              );
            }}
          >
            Xem chi tiết
          </button>
        ),
      },
    ];

  // ─── Horse table ─────────────────────────────────────────────────────────

  const horseColumns: DataTableColumn<HorseApproval>[] =
    [
      {
        key: 'subject',
        header: 'Tên ngựa',
        render: (row) => (
          <span
            className={
              styles.subjectCell
            }
          >
            {row.subject}
          </span>
        ),
      },
      {
        key: 'stable',
        header: 'Tournament',
        render: (row) =>
          row.stable,
      },
      {
        key: 'submittedDate',
        header: 'Ngày nộp',
        render: (row) =>
          row.submittedDate,
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (row) => (
          <StatusBadge
            status={row.status}
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
            className={
              styles.detailBtn
            }
            onClick={() => {
              setError('');
              setSelectedHorse(row);
            }}
          >
            Xem chi tiết
          </button>
        ),
      },
    ];

  const displayedCount =
    activeGroup === 'horse'
      ? horseItems.length
      : combinedRegistrationRows.length;

  return (
    <div
      className={styles.container}
    >
      {/* Header */}

      <div className={styles.header}>
        <h1
          className={styles.heading}
        >
          Admin Workspace
        </h1>
      </div>

      <div
        className={styles.subHeader}
      >
        <div>
          <h2
            className={
              styles.subHeading
            }
          >
            Approval Center
          </h2>
        </div>

        <span
          className={
            styles.countBadge
          }
        >
          {displayedCount} hồ sơ
        </span>
      </div>

      {/* Main groups */}

      <div
        className={styles.groupGrid}
      >
        {GROUPS.map((group) => (
          <button
            key={group.key}
            type="button"
            className={`${
              styles.groupCard
            } ${
              activeGroup ===
              group.key
                ? styles.groupCardActive
                : ''
            }`}
            onClick={() => {
              setActiveGroup(
                group.key
              );

              setSelectedRegistration(
                null
              );

              setSelectedHorse(null);
              setError('');
            }}
          >
            <span>
              {group.icon}
            </span>

            <span
              className={
                styles.groupTitle
              }
            >
              {group.title}
            </span>

            <span
              className={
                styles.groupDesc
              }
            >
              {group.description}
            </span>
          </button>
        ))}
      </div>

      {/* Banner */}

      {activeGroup ===
        'registration' ? (
        <div
          className={styles.banner}
        >
          Quản lý chung hồ sơ đăng ký
          tài khoản của Jockey, Trọng
          tài, Bác sĩ và các lượt đăng
          ký tham gia Tournament.
        </div>
      ) : (
        <div
          className={styles.banner}
        >
          Duyệt hồ sơ sức khỏe và định
          danh của ngựa.
        </div>
      )}

      {error && (
        <div
          className={styles.errorBox}
        >
          {error}
        </div>
      )}

      {/* Content */}

      <div
        className={styles.lightTable}
      >
        {activeGroup === 'horse' ? (
          horseLoading ? (
            <p
              className={
                styles.loadingText
              }
            >
              Đang tải danh sách hồ sơ
              ngựa...
            </p>
          ) : (
            <DataTable
              columns={horseColumns}
              data={horseItems}
              rowKey={(row) => row.id}
              emptyMessage="Không có hồ sơ ngựa nào đang chờ duyệt."
            />
          )
        ) : (
          <>
            {/* Một bộ lọc duy nhất cho bảng đã gộp */}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <select
                value={
                  selectedTournamentId ??
                  ''
                }
                onChange={(event) =>
                  setSelectedTournamentId(
                    Number(
                      event.target.value
                    ) || null
                  )
                }
                style={{
                  minWidth: '280px',
                  padding: '10px 12px',
                  border:
                    '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: '#fff',
                }}
              >
                {tournaments.length ===
                  0 && (
                  <option value="">
                    Chưa có Tournament
                  </option>
                )}

                {tournaments.map(
                  (tournament) => (
                    <option
                      key={
                        tournament.id
                      }
                      value={
                        tournament.id
                      }
                    >
                      {
                        tournament.name
                      }
                    </option>
                  )
                )}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                style={{
                  padding: '10px 12px',
                  border:
                    '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: '#fff',
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

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(
                    event.target.value
                  )
                }
                style={{
                  padding: '10px 12px',
                  border:
                    '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: '#fff',
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
            </div>

            {registrationLoading ? (
              <p
                className={
                  styles.loadingText
                }
              >
                Đang tải danh sách đăng
                ký...
              </p>
            ) : (
              <DataTable
                columns={
                  registrationColumns
                }
                data={
                  combinedRegistrationRows
                }
                rowKey={(row) =>
                  row.id
                }
                emptyMessage="Không có hồ sơ đăng ký phù hợp."
              />
            )}
          </>
        )}
      </div>

      {/* Combined registration detail */}

      {selectedRegistration && (
        <UserDetailModal
          userId={String(
            selectedRegistration.userId
          )}
          role={
            selectedRegistration.role
          }
          basicInfo={{
            username:
              selectedRegistration.username,
            'Full Name':
              selectedRegistration.fullName,
            email:
              selectedRegistration.email,
            role:
              selectedRegistration.role,
            status: String(
              selectedRegistration.status
            ),
            joinedDate:
              selectedRegistration.submittedDate,
            Tournament:
              selectedRegistration.tournamentName,
          }}
          showActions={
            String(
              selectedRegistration.status
            ).toLowerCase() ===
              'pending' &&
            !actionLoading
          }
          onApprove={
            handleApproveRegistration
          }
          onReject={
            handleRejectRegistration
          }
          onClose={() =>
            setSelectedRegistration(
              null
            )
          }
        />
      )}

      {/* Horse detail */}

      {selectedHorse && (
        <ApprovalDetailPanel
          item={selectedHorse}
          onClose={() =>
            setSelectedHorse(null)
          }
          onSuccess={(
            newStatus
          ) => {
            setHorseItems(
              (currentItems) =>
                currentItems.map(
                  (item) =>
                    item.id ===
                    selectedHorse.id
                      ? {
                          ...item,
                          status:
                            newStatus as StatusType,
                        }
                      : item
                )
            );

            setSelectedHorse(null);
          }}
        />
      )}
    </div>
  );
};

export default ApprovalCenter;