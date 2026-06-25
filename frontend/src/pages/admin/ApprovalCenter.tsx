import { useCallback, useEffect, useState } from 'react';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import ApprovalDetailPanel from './ApprovalDetailPanel';
import {
  getPendingHorses,
  getPendingApprovals,
  type HorsePending,
  type PersonPending,
} from '../../services/approvalService';
import styles from './ApprovalCenter.module.scss';

// ─── Types ──────────────────────────────────────────────────────────────────
export type ApprovalTab = 'horse' | 'jockey' | 'onboarding';

export interface HorseApproval {
  id: string;
  entityId: number; // horseId — dùng gọi API
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
  entityId: number; // userId — dùng gọi API
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
  entityId: number; // userId — dùng gọi API
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
  // Bước duyệt ngựa không gắn với 1 giải cụ thể → không có Allowed Breed để
  // so sánh; đặt bằng breed để không hiện cảnh báo lệch giả.
  allowedBreed: h.breed,
  dopingTestResult: h.dopingTestResult || 'Pending',
  vaccinationRecordRef: h.vaccinationRecordRef,
  // Phí tham dự là khái niệm Race Entry, không áp ở duyệt ngựa → coi như Paid.
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

const TABS: { key: ApprovalTab; label: string }[] = [
  { key: 'horse', label: 'Ngựa' },
  { key: 'jockey', label: 'Jockey' },
  { key: 'onboarding', label: 'Onboarding Referee-Doctor' },
];

const ApprovalCenter = () => {
  const [activeTab, setActiveTab] = useState<ApprovalTab>('horse');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'horse') {
        const horses = await getPendingHorses();
        setItems(horses.map(mapHorse));
      } else {
        const { referees, doctors, jockeys } = await getPendingApprovals();
        if (activeTab === 'jockey') {
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
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns: DataTableColumn<ApprovalItem>[] = [
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => <span className={styles.subjectCell}>{row.subject}</span>,
    },
    {
      key: 'type',
      header: 'Type',
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
      header: activeTab === 'onboarding' ? 'Role' : 'Origin / Stable',
      render: (row) => row.stable,
    },
    {
      key: 'status',
      header: 'Status',
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

  return (
    <div className={styles.container}>
      {/* ═══ HEADER ═══════════════════════════════════════════ */}
      <div className={styles.header}>
        <h1 className={styles.heading}>Approval Center</h1>
        <p className={styles.subtext}>
          Review and manage registration requests for horses and personnel.
        </p>
      </div>

      {/* ═══ TABS ═════════════════════════════════════════════ */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab(tab.key);
              setSelectedItem(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 8,
          background: 'rgba(181,18,27,0.15)', border: '1px solid rgba(181,18,27,0.4)',
          color: '#ff6b6b',
        }}>
          {error}
        </div>
      )}

      {/* ═══ TABLE ════════════════════════════════════════════ */}
      {loading ? (
        <p style={{ color: '#999', padding: '1rem 0' }}>Đang tải danh sách hồ sơ...</p>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          rowKey={(row) => row.id}
          emptyMessage="Không có hồ sơ nào cần duyệt."
        />
      )}

      {/* ═══ DETAIL PANEL (drawer bên phải) ══════════════════ */}
      {selectedItem && (
        <ApprovalDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSuccess={() => {
            setSelectedItem(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default ApprovalCenter;
