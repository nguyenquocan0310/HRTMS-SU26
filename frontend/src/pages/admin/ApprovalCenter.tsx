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
import RosterApprovalTable from './RosterApprovalTable';

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

export type RegistrationSubTab =
  | 'personnel'
  | 'tournament';

export interface HorseApproval {
  id: string;

  /**
   * enrollmentId:
   * dùng cho approve/reject Horse Enrollment.
   */
  entityId: number;

  /**
   * horseId:
   * dùng để gọi GET /admin/horses/{horseId}.
   */
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

  /**
   * userId:
   * dùng cho:
   * - GET /admin/users/{userId}
   * - GET /certificates/user/{userId}
   * - approve/reject personnel.
   */
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

const REGISTRATION_SUB_TABS: Array<{
  key: RegistrationSubTab;
  label: string;
}> = [
  {
    key: 'personnel',
    label: 'Nhân viên',
  },
  {
    key: 'tournament',
    label: 'Đăng ký Tournament',
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

  // Các field chi tiết sẽ được ApprovalDetailPanel
  // gọi riêng bằng GET /admin/horses/{horseId}.
  breed: '',
  allowedBreed: '',
  dopingTestResult: 'Pending',
  vaccinationRecordRef: '',

  // DTO pending hiện không trả entryFeeStatus.
  // Giữ Paid để không chặn nút Approve ngựa ngoài ý muốn.
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
    registrationSubTab,
    setRegistrationSubTab,
  ] =
    useState<RegistrationSubTab>('personnel');

  const [
    personnelItems,
    setPersonnelItems,
  ] =
    useState<PersonnelApproval[]>([]);

  const [
    horseItems,
    setHorseItems,
  ] =
    useState<HorseApproval[]>([]);

  const [
    selectedPersonnel,
    setSelectedPersonnel,
  ] =
    useState<PersonnelApproval | null>(
      null
    );

  const [
    selectedHorse,
    setSelectedHorse,
  ] =
    useState<HorseApproval | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState(false);

  // ─── Load personnel ──────────────────────────────────────────────────────

  const loadPersonnel =
    useCallback(async () => {
      setLoading(true);
      setError('');

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

        setError(
          err instanceof Error
            ? err.message
            : 'Không tải được danh sách hồ sơ đăng ký.'
        );
      } finally {
        setLoading(false);
      }
    }, []);

  // ─── Load horses ─────────────────────────────────────────────────────────

  const loadHorses =
    useCallback(async () => {
      setLoading(true);
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
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    if (activeGroup === 'horse') {
      loadHorses();
      return;
    }

    if (
      registrationSubTab !==
      'tournament'
    ) {
      loadPersonnel();
    }
  }, [
    activeGroup,
    registrationSubTab,
    loadHorses,
    loadPersonnel,
  ]);

  // ─── Filter personnel theo tab ───────────────────────────────────────────

const displayedPersonnel = useMemo(() => {
  if (registrationSubTab === 'personnel') {
    return personnelItems;
  }

  return [];
}, [personnelItems, registrationSubTab]);

  // ─── Approve personnel ───────────────────────────────────────────────────

  const handleApprovePersonnel =
    async () => {
      if (
        !selectedPersonnel ||
        actionLoading
      ) {
        return;
      }

      setActionLoading(true);
      setError('');

      try {
        if (
          selectedPersonnel.role ===
          'Jockey'
        ) {
          await approveJockey(
            selectedPersonnel.entityId
          );
        } else if (
          selectedPersonnel.role ===
          'Referee'
        ) {
          await approveReferee(
            selectedPersonnel.entityId
          );
        } else {
          await approveDoctor(
            selectedPersonnel.entityId
          );
        }

        setPersonnelItems(
          (currentItems) =>
            currentItems.map(
              (item) =>
                item.id ===
                selectedPersonnel.id
                  ? {
                      ...item,
                      status:
                        'Approved' as StatusType,
                    }
                  : item
            )
        );

        setSelectedPersonnel(null);
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

  // ─── Reject personnel ────────────────────────────────────────────────────

  const handleRejectPersonnel =
    async () => {
      if (
        !selectedPersonnel ||
        actionLoading
      ) {
        return;
      }

      const reason = window.prompt(
        'Nhập lý do từ chối hồ sơ (tối thiểu 10 ký tự):'
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
          selectedPersonnel.role ===
          'Jockey'
        ) {
          await rejectJockey(
            selectedPersonnel.entityId,
            trimmedReason
          );
        } else if (
          selectedPersonnel.role ===
          'Referee'
        ) {
          await rejectReferee(
            selectedPersonnel.entityId,
            trimmedReason
          );
        } else {
          await rejectDoctor(
            selectedPersonnel.entityId,
            trimmedReason
          );
        }

        setPersonnelItems(
          (currentItems) =>
            currentItems.map(
              (item) =>
                item.id ===
                selectedPersonnel.id
                  ? {
                      ...item,
                      status:
                        'Rejected' as StatusType,
                    }
                  : item
            )
        );

        setSelectedPersonnel(null);
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

  // ─── Personnel table ─────────────────────────────────────────────────────

  const personnelColumns: DataTableColumn<PersonnelApproval>[] =
    [
      {
        key: 'subject',
        header: 'Người đăng ký',
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
        key: 'email',
        header: 'Email',
        render: (row) =>
          row.email || '—',
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) =>
          row.role,
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
              setSelectedPersonnel(
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
      : registrationSubTab ===
          'tournament'
        ? null
        : displayedPersonnel.length;

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

        {displayedCount !== null && (
          <span
            className={
              styles.countBadge
            }
          >
            {displayedCount} hồ sơ
          </span>
        )}
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

              setSelectedPersonnel(
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

      {/* Registration group */}

      {activeGroup ===
        'registration' && (
        <>
          <div
            className={styles.banner}
          >
            Quản lý hồ sơ đăng ký của
            Jockey, Trọng tài, Bác sĩ
            và các lượt đăng ký tham
            gia Tournament.
          </div>

          <div
            className={styles.subTabs}
          >
            {REGISTRATION_SUB_TABS.map(
              (tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`${
                    styles.subTabBtn
                  } ${
                    registrationSubTab ===
                    tab.key
                      ? styles.subTabBtnActive
                      : ''
                  }`}
                  onClick={() => {
                    setRegistrationSubTab(
                      tab.key
                    );

                    setSelectedPersonnel(
                      null
                    );

                    setError('');
                  }}
                >
                  {tab.label}
                </button>
              )
            )}
          </div>
        </>
      )}

      {/* Horse banner */}

      {activeGroup === 'horse' && (
        <div
          className={styles.banner}
        >
          Duyệt hồ sơ sức khỏe và
          định danh của ngựa. Phần này
          được giữ nguyên, không gộp
          với hồ sơ người dùng.
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
        {activeGroup ===
        'horse' ? (
          loading ? (
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
        ) : registrationSubTab ===
          'tournament' ? (
          <RosterApprovalTable />
        ) : loading ? (
          <p
            className={
              styles.loadingText
            }
          >
            Đang tải danh sách hồ sơ...
          </p>
        ) : (
          <DataTable
            columns={
              personnelColumns
            }
            data={
              displayedPersonnel
            }
            rowKey={(row) => row.id}
            emptyMessage="Không có hồ sơ nào đang chờ duyệt."
          />
        )}
      </div>

      {/* Personnel detail:
          dùng nguyên UserDetailModal
          giống trang User Management. */}

      {selectedPersonnel && (
        <UserDetailModal
          userId={String(
            selectedPersonnel.entityId
          )}
          role={
            selectedPersonnel.role
          }
          basicInfo={{
            username:
              selectedPersonnel.username,
            'Full Name':
              selectedPersonnel.subject,
            email:
              selectedPersonnel.email,
            role:
              selectedPersonnel.role,
            status: String(
              selectedPersonnel.status
            ),
            joinedDate:
              selectedPersonnel.submittedDate,
          }}
          showActions={
            String(
              selectedPersonnel.status
            ).toLowerCase() ===
            'pending'
          }
          onApprove={
            handleApprovePersonnel
          }
          onReject={
            handleRejectPersonnel
          }
          onClose={() =>
            setSelectedPersonnel(null)
          }
        />
      )}

      {/* Horse detail:
          giữ ApprovalDetailPanel cũ. */}

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