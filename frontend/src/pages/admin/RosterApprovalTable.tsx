import { useState } from 'react';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import styles from './ApprovalCenter.module.scss';

// TODO(API): thay bằng response thật khi BE có endpoint
// GET /tournament/{id}/registrations hoặc tương đương.
export interface RosterRegistration {
  id: string;
  tournamentName: string;
  horseName: string;
  ownerName: string;
  jockeyName: string;
  submittedDate: string;
  status: StatusType;
}

const RosterApprovalTable = () => {
  // Placeholder — chưa có API thật nên để rỗng, UI sẵn sàng nối khi BE có endpoint.
  const [items] = useState<RosterRegistration[]>([]);
  const [loading] = useState(false);

  const columns: DataTableColumn<RosterRegistration>[] = [
    { key: 'tournamentName', header: 'Tournament', render: (r) => r.tournamentName },
    { key: 'horseName', header: 'Horse', render: (r) => <span className={styles.subjectCell}>{r.horseName}</span> },
    { key: 'ownerName', header: 'Owner', render: (r) => r.ownerName },
    { key: 'jockeyName', header: 'Jockey', render: (r) => r.jockeyName },
    { key: 'submittedDate', header: 'Submitted', render: (r) => r.submittedDate },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'action',
      header: '',
      width: '140px',
      render: () => (
        <button type="button" className={styles.detailBtn}>
          Xem chi tiết
        </button>
      ),
    },
  ];

  if (loading) {
    return <p className={styles.loadingText}>Đang tải đăng ký...</p>;
  }

  return (
    <DataTable
      columns={columns}
      data={items}
      rowKey={(row) => row.id}
      emptyMessage="Không có đăng ký nào đang chờ duyệt."
    />
  );
};

export default RosterApprovalTable;