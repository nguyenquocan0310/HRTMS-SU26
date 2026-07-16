/* eslint-disable react-hooks/set-state-in-effect -- Log data is fetched when pagination changes. */
import { useEffect, useState } from 'react';
import { FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi';
import { getAuditLogs, type AuditLogItem } from '../../services/adminService';
import styles from './AuditLog.module.scss';

const actionLabel = (action: string) => ({
  Admin_Create_User: 'Tạo tài khoản', Suspend_User: 'Tạm ngưng tài khoản', Activate_User: 'Kích hoạt tài khoản', Update_Payout_Status: 'Cập nhật trạng thái chi trả', Export_Report: 'Xuất báo cáo', Update_Profile: 'Cập nhật hồ sơ', Change_Password: 'Đổi mật khẩu',
}[action] ?? 'Thao tác hệ thống');
const entityLabel = (entity: string) => ({ Users: 'Tài khoản', PursePayout: 'Khoản chi trả', Tournament: 'Giải đấu', Race: 'Cuộc đua', Report: 'Báo cáo' }[entity] ?? 'Dữ liệu hệ thống');
const formatValue = (value: string | null) => !value ? '—' : value.length > 160 ? `${value.slice(0, 160)}…` : value;

const AuditLog = () => {
  const [items, setItems] = useState<AuditLogItem[]>([]); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const pageSize = 20;
  const load = async () => { setLoading(true); setError(''); try { const result = await getAuditLogs({ page, pageSize, from: from || undefined, to: to || undefined }); setItems(result.data); setTotal(result.total); } catch (requestError) { setItems([]); setError(requestError instanceof Error ? requestError.message : 'Không tải được nhật ký hoạt động.'); } finally { setLoading(false); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [page]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <div className={styles.container}><div className={styles.header}><div><h1>Nhật ký hoạt động</h1><p>Chỉ xem các hoạt động hệ thống; nhật ký không thể chỉnh sửa hoặc xóa.</p></div><button type="button" onClick={() => void load()} disabled={loading}><FiRefreshCw size={15} /> Làm mới</button></div><div className={styles.filters}><label>Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Đến ngày<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button type="button" onClick={() => { setPage(1); void load(); }}>Áp dụng bộ lọc</button></div>{error && <div className={styles.error} role="alert">{error}</div>}<div className={styles.card}>{loading ? <p className={styles.empty}>Đang tải nhật ký...</p> : items.length === 0 ? <p className={styles.empty}>Chưa có bản ghi nhật ký phù hợp.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Thời gian</th><th>Người thao tác</th><th>Hành động</th><th>Loại dữ liệu</th><th>Kết quả</th><th>Trước / sau</th></tr></thead><tbody>{items.map((item) => <tr key={item.auditLogId}><td>{new Date(item.createdAt).toLocaleString('vi-VN')}</td><td>Người dùng #{item.actorId}</td><td>{actionLabel(item.action)}</td><td>{entityLabel(item.entityName)}</td><td>Hoàn tất</td><td><span>Trước: {formatValue(item.oldValue)}</span><span>Sau: {formatValue(item.newValue)}</span></td></tr>)}</tbody></table></div>}</div><div className={styles.pagination}><span>Trang {page}/{totalPages} · {total} bản ghi</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><FiChevronLeft size={15} /> Trước</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Sau <FiChevronRight size={15} /></button></div></div></div>;
};

export default AuditLog;
