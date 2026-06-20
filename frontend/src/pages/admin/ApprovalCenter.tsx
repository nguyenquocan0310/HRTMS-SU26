import { useState } from 'react';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import ApprovalDetailPanel from './ApprovalDetailPanel';
import styles from './ApprovalCenter.module.scss';

// ─── Types ──────────────────────────────────────────────────────────────────
export type ApprovalTab = 'horse' | 'jockey' | 'onboarding';

export interface HorseApproval {
  id: string;
  type: 'horse';
  subject: string; // tên ngựa
  submittedDate: string;
  stable: string; // tổ chức/chuồng ngựa
  status: StatusType;
  breed: string;
  allowedBreed: string;
  dopingTestResult: 'Passed' | 'Failed' | 'Pending';
  vaccinationRecordRef: string;
  entryFeeStatus: 'Paid' | 'Unpaid';
}

export interface JockeyApproval {
  id: string;
  type: 'jockey';
  subject: string; // tên jockey
  submittedDate: string;
  stable: string; // tổ chức liên kết
  status: StatusType;
  licenseCertificate: string;
  experienceYears: number;
}

export interface OnboardingApproval {
  id: string;
  type: 'onboarding';
  subject: string; // tên người
  submittedDate: string;
  stable: string; // role: Referee / Doctor
  status: StatusType;
  role: 'Referee' | 'Doctor';
  certificationLevel?: string;
  medicalLicenseNumber?: string;
}

export type ApprovalItem = HorseApproval | JockeyApproval | OnboardingApproval;

// ─── Mock data — TODO: thay bằng API khi có Swagger (Điều 6) ───────────────
// Dự kiến: GET /api/admin/approvals?type=horse|jockey|onboarding&status=pending
const MOCK_HORSES: HorseApproval[] = [
  {
    id: 'h1', type: 'horse', subject: 'Thunder Bolt', submittedDate: '18/06/2026',
    stable: 'Golden Stable', status: 'Pending', breed: 'Thoroughbred', allowedBreed: 'Thoroughbred',
    dopingTestResult: 'Passed', vaccinationRecordRef: 'VAC-2026-0091', entryFeeStatus: 'Paid',
  },
  {
    id: 'h2', type: 'horse', subject: 'Silver Wind', submittedDate: '17/06/2026',
    stable: 'Royal Stable', status: 'Pending', breed: 'Thoroughbred', allowedBreed: 'Thoroughbred',
    dopingTestResult: 'Passed', vaccinationRecordRef: 'VAC-2026-0088', entryFeeStatus: 'Unpaid',
  },
  {
    id: 'h3', type: 'horse', subject: 'Desert Storm', submittedDate: '15/06/2026',
    stable: 'Meydan Stable', status: 'AutoRejected', breed: 'Arabian', allowedBreed: 'Thoroughbred',
    dopingTestResult: 'Passed', vaccinationRecordRef: 'VAC-2026-0079', entryFeeStatus: 'Paid',
  },
];

const MOCK_JOCKEYS: JockeyApproval[] = [
  {
    id: 'j1', type: 'jockey', subject: 'Trần Văn Hùng', submittedDate: '18/06/2026',
    stable: 'Tự do', status: 'Pending', licenseCertificate: 'LIC-JK-2024-114', experienceYears: 6,
  },
  {
    id: 'j2', type: 'jockey', subject: 'Lê Minh Khôi', submittedDate: '16/06/2026',
    stable: 'Royal Stable', status: 'Pending', licenseCertificate: 'LIC-JK-2024-098', experienceYears: 3,
  },
];

const MOCK_ONBOARDING: OnboardingApproval[] = [
  {
    id: 'o1', type: 'onboarding', subject: 'Phạm Thị Lan', submittedDate: '19/06/2026',
    stable: 'Referee', status: 'Pending', role: 'Referee', certificationLevel: 'Cấp 2',
  },
  {
    id: 'o2', type: 'onboarding', subject: 'Bác sĩ Đỗ Quang Huy', submittedDate: '17/06/2026',
    stable: 'Doctor', status: 'Pending', role: 'Doctor', medicalLicenseNumber: 'MED-VN-22841',
  },
];

const TABS: { key: ApprovalTab; label: string }[] = [
  { key: 'horse', label: 'Ngựa' },
  { key: 'jockey', label: 'Jockey' },
  { key: 'onboarding', label: 'Onboarding Referee-Doctor' },
];

const ApprovalCenter = () => {
  const [activeTab, setActiveTab] = useState<ApprovalTab>('horse');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  const getDataForTab = (): ApprovalItem[] => {
    if (activeTab === 'horse') return MOCK_HORSES;
    if (activeTab === 'jockey') return MOCK_JOCKEYS;
    return MOCK_ONBOARDING;
  };

  const data = getDataForTab();

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
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TABLE ════════════════════════════════════════════ */}
      <DataTable
        columns={columns}
        data={data}
        rowKey={(row) => row.id}
        emptyMessage="Không có hồ sơ nào cần duyệt."
      />

      {/* ═══ DETAIL PANEL (drawer bên phải) ══════════════════ */}
      {selectedItem && (
        <ApprovalDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

export default ApprovalCenter;