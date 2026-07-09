import { useCallback, useEffect, useState } from 'react';
import { FiShield, FiFlag, FiActivity } from 'react-icons/fi';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import ApprovalDetailPanel from './ApprovalDetailPanel';
import RosterApprovalTable from './RosterApprovalTable';
import {
  getPendingHorses,
  getPendingApprovals,
  type HorsePending,
  type PersonPending,
} from '../../services/approvalService';
import styles from './ApprovalCenter.module.scss';

// ─── Types ──────────────────────────────────────────────────────────────────
export type ApprovalGroup = 'account' | 'roster' | 'horse';
export type AccountSubTab = 'jockey' | 'onboarding';

export interface HorseApproval {
  id: string;
  entityId: number;
  type: 'horse';
  subject: string;
  submittedDate: string;
  stable: string;
  status: StatusType;
  breed: string;
  allowedBreed: string;
  dopingTestResult: 'Passed' | 'Failed' | 'Pending' | string;
  vaccinationRecordRef: string;
  entryFeeStatus: 'Paid' | 'Unpaid';
}

export interface JockeyApproval {
  id: string;
  entityId: number;
  type: 'jockey';
  subject: string;
  submittedDate: string;
  stable: string;
  status: StatusType;
  licenseCertificate: string;
  experienceYears?: number;
}

export interface OnboardingApproval {
  id: string;
  entityId: number;
  type: 'onboarding';
  subject: string;
  submittedDate: string;
  stable: string;
  status: StatusType;
  role: 'Referee' | 'Doctor';
  certificationLevel?: string;
  medicalLicenseNumber?: string;
}

export type ApprovalItem = HorseApproval | JockeyApproval | OnboardingApproval;

// ─── Map dữ liệu BE → item hiển thị ─────────────────────────────────────────
const formatDate = (iso: string): string =>
  iso ? new Date(iso).toLocaleDateString('vi-VN') : '—';

const mapHorse = (h: HorsePending): HorseApproval => ({
  id: `h${h.horseId}`,
  entityId: h.horseId,
  type: 'horse',
  subject: h.name,
  submittedDate: formatDate(h.createdAt),
  stable: `Owner #${h.ownerId}`,
  status: h.adminApprovalStatus as StatusType,
  breed: h.breed,
  allowedBreed: h.breed,
  dopingTestResult: h.dopingTestResult || 'Pending',
  vaccinationRecordRef: h.vaccinationRecordRef,
  entryFeeStatus: 'Paid',
});

const mapJockey = (p: PersonPending): JockeyApproval => ({
  id: `j${p.userId}`,
  entityId: p.userId,
  type: 'jockey',
  subject: p.fullName,
  submittedDate: formatDate(p.createdAt),
  stable: '—',
  status: p.profileStatus as StatusType,
  licenseCertificate: p.certificationLevel ?? '—',
});

const mapPerson = (p: PersonPending, role: 'Referee' | 'Doctor'): OnboardingApproval => ({
  id: `o${p.userId}`,
  entityId: p.userId,
  type: 'onboarding',
  subject: p.fullName,
  submittedDate: formatDate(p.createdAt),
  stable: role,
  status: p.profileStatus as StatusType,
  role,
  certificationLevel: role === 'Referee' ? p.certificationLevel ?? undefined : undefined,
  medicalLicenseNumber: role === 'Doctor' ? p.certificationLevel ?? undefined : undefined,
});

// ─── 3 nhóm chính (group card) ───────────────────────────────────────────────
const GROUPS: { key: ApprovalGroup; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'account', title: 'Hồ sơ tài khoản', desc: 'Jockey, Trọng tài, Bác sĩ', icon: <FiShield size={18} /> },
  { key: 'roster', title: 'Đăng ký vào giải', desc: 'Roster theo từng tournament', icon: <FiFlag size={18} /> },
  { key: 'horse', title: 'Hồ sơ ngựa', desc: 'Sức khỏe và định danh ngựa', icon: <FiActivity size={18} /> },
];

const ACCOUNT_SUB_TABS: { key: AccountSubTab; label: string }[] = [
  { key: 'jockey', label: 'Jockey' },
  { key: 'onboarding', label: 'Trọng tài / Bác sĩ' },
];

const ApprovalCenter = () => {
  const [activeGroup, setActiveGroup] = useState<ApprovalGroup>('account');
  const [accountSubTab, setAccountSubTab] = useState<AccountSubTab>('jockey');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (activeGroup === 'roster') {
      setError('');
      return;
    } // Roster tự load trong RosterApprovalTable.
    setLoading(true);
    setError('');
    try {
      if (activeGroup === 'horse') {
        const horses = await getPendingHorses();
        setItems(horses.map(mapHorse));
      } else {
        const { referees, doctors, jockeys } = await getPendingApprovals();
        if (accountSubTab === 'jockey') {
          setItems(jockeys.map(mapJockey));
        } else {
          setItems([
            ...referees.map((r) => mapPerson(r, 'Referee')),
            ...doctors.map((d) => mapPerson(d, 'Doctor')),
          ]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách hồ sơ.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeGroup, accountSubTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns: DataTableColumn<ApprovalItem>[] = [
    {
      key: 'subject',
      header: 'Người đăng ký',
      render: (row) => <span className={styles.subjectCell}>{row.subject}</span>,
    },
    {
      key: 'type',
      header: 'Nhóm',
      render: (row) => {
        if (row.type === 'onboarding') return row.role;
        return row.type === 'horse' ? 'Horse' : 'Jockey';
      },
    },
    {
      key: 'submittedDate',
      header: 'Ngày nộp',
      render: (row) => row.submittedDate,
    },
    {
      key: 'stable',
      header: activeGroup === 'account' && accountSubTab === 'onboarding' ? 'Role' : 'Origin / Stable',
      render: (row) => row.stable,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'action',
      header: '',
      width: '140px',
      render: (row) => (
        <button
          type="button"
          className={styles.detailBtn}
          onClick={() => setSelectedItem(row)}
        >
          Xem chi tiết
        </button>
      ),
    },
  ];

  const totalCount = items.length;

  return (
    <div className={styles.container}>
      {/* ═══ HEADER ═══════════════════════════════════════════ */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Admin Workspace</h1>
          <p className={styles.subtext}>System operations and governance</p>
        </div>
      </div>

      <div className={styles.subHeader}>
        <div>
          <h2 className={styles.subHeading}>Approval Center</h2>
          <p className={styles.subtext}>
            Tách riêng hồ sơ tài khoản, hồ sơ ngựa và đăng ký tham gia giải để admin duyệt đúng ngữ cảnh.
          </p>
        </div>
        {activeGroup !== 'roster' && (
          <span className={styles.countBadge}>{totalCount} hồ sơ</span>
        )}
      </div>

      {/* ═══ GROUP CARDS ══════════════════════════════════════ */}
      <div className={styles.groupGrid}>
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`${styles.groupCard} ${activeGroup === g.key ? styles.groupCardActive : ''}`}
            onClick={() => {
              setActiveGroup(g.key);
              setSelectedItem(null);
            }}
          >
            <span className={styles.groupTitle}>{g.title}</span>
            <span className={styles.groupDesc}>{g.desc}</span>
          </button>
        ))}
      </div>

      {/* ═══ BANNER MÔ TẢ NHÓM ════════════════════════════════ */}
      {activeGroup === 'account' && (
        <div className={styles.banner}>
          Duyệt hồ sơ năng lực của Jockey, Trọng tài và Bác sĩ trước khi họ được dùng workspace vận hành.
        </div>
      )}
      {activeGroup === 'roster' && (
        <div className={styles.banner}>
          Duyệt đơn đăng ký Horse tham gia một Tournament cụ thể. Sau khi Approve, hồ sơ sẽ vào Tournament Roster.
        </div>
      )}
      {activeGroup === 'horse' && (
        <div className={styles.banner}>
          Duyệt hồ sơ sức khỏe và định danh của ngựa trước khi được phép đăng ký vào bất kỳ giải nào.
        </div>
      )}

      {/* ═══ SUB-TABS (chỉ nhóm Hồ sơ tài khoản) ══════════════ */}
      {activeGroup === 'account' && (
        <div className={styles.subTabs}>
          {ACCOUNT_SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.subTabBtn} ${accountSubTab === tab.key ? styles.subTabBtnActive : ''}`}
              onClick={() => {
                setAccountSubTab(tab.key);
                setSelectedItem(null);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {error && <div className={styles.errorBox}>{error}</div>}

      {/* ═══ NỘI DUNG THEO NHÓM ════════════════════════════════ */}
      <div className={styles.lightTable}>
      {activeGroup === 'roster' ? (
        <RosterApprovalTable />
      ) : loading ? (
        <p className={styles.loadingText}>Đang tải danh sách hồ sơ...</p>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          rowKey={(row) => row.id}
          emptyMessage={
            activeGroup === 'horse'
              ? 'Không có hồ sơ ngựa nào đang chờ duyệt.'
              : 'Không có hồ sơ tài khoản nào đang chờ duyệt.'
          }
        />
      )}
      </div>


      {/* ═══ DETAIL PANEL ══════════════════════════════════════ */}
{selectedItem && (
  <ApprovalDetailPanel
    item={selectedItem}
    onClose={() => setSelectedItem(null)}
    onSuccess={(newStatus) => {
      setItems((prev) =>
        prev.map((it) => (it.id === selectedItem.id ? { ...it, status: newStatus } : it))
      );
      setSelectedItem(null);
    }}
  />
)}
    </div>
  );
};

export default ApprovalCenter;