/* eslint-disable react-hooks/set-state-in-effect -- Report preview is fetched for the current selection. */
import { useEffect, useState } from 'react';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import { exportCsvReport, getReportPreview, type ReportPreview, type ReportType } from '../../services/reportService';
import styles from './Reports.module.scss';

const REPORT_OPTIONS: Array<{ value: ReportType; label: string; description: string }> = [
  { value: 'tournament-results', label: 'Kết quả giải đấu', description: 'Tổng hợp kết quả chính thức trong giải.' },
  { value: 'race-results', label: 'Kết quả cuộc đua', description: 'Chi tiết kết quả của từng cuộc đua.' },
  { value: 'purse-payouts', label: 'Chi trả tiền thưởng', description: 'Các khoản thưởng đã được hệ thống ghi nhận.' },
  { value: 'entry-list', label: 'Danh sách đăng ký', description: 'Danh sách ngựa và nài ngựa tham gia.' },
];

const Reports = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [type, setType] = useState<ReportType>('tournament-results');
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getTournaments().then((items) => { setTournaments(items); setTournamentId(items[0]?.tournamentId ?? null); }).catch(() => setError('Không tải được danh sách giải đấu. Vui lòng thử lại.')).finally(() => setLoading(false));
  }, []);

  const loadPreview = async () => {
    if (!tournamentId) return;
    setLoading(true); setError('');
    try { setPreview(await getReportPreview(type, tournamentId)); }
    catch (requestError) { setPreview(null); setError(requestError instanceof Error ? requestError.message : 'Không tải được báo cáo.'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tournamentId) void loadPreview(); }, [type, tournamentId]);

  const handleExport = async () => {
    if (!tournamentId || exporting) return;
    setExporting(true); setError('');
    try {
      const { blob, fileName } = await exportCsvReport(type, tournamentId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = fileName; anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Không thể xuất báo cáo.'); }
    finally { setExporting(false); }
  };

  const selectedType = REPORT_OPTIONS.find((option) => option.value === type);
  return <div className={styles.container}>
    <div className={styles.header}><div><h1>Báo cáo</h1><p>Xem trước và xuất dữ liệu CSV do hệ thống cung cấp.</p></div><button type="button" className={styles.exportBtn} onClick={() => void handleExport()} disabled={!tournamentId || exporting}><FiDownload size={15} /> {exporting ? 'Đang xuất...' : 'Xuất CSV'}</button></div>
    <section className={styles.card}><div className={styles.filters}><label>Loại báo cáo<select value={type} onChange={(event) => setType(event.target.value as ReportType)}>{REPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Giải đấu<select value={tournamentId ?? ''} onChange={(event) => setTournamentId(Number(event.target.value))}>{tournaments.map((item) => <option key={item.tournamentId} value={item.tournamentId}>{item.name}</option>)}</select></label><button type="button" className={styles.refreshBtn} onClick={() => void loadPreview()} disabled={loading || !tournamentId}><FiRefreshCw size={15} /> Làm mới</button></div><p className={styles.description}>{selectedType?.description}</p></section>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <section className={styles.card}><h2>Xem trước</h2>{loading ? <p className={styles.empty}>Đang tải báo cáo...</p> : !preview ? <p className={styles.empty}>Chưa có dữ liệu báo cáo.</p> : preview.rows.length === 0 ? <p className={styles.empty}>Báo cáo chưa có dữ liệu phù hợp với giải đấu đã chọn.</p> : <div className={styles.tableWrap}><table><thead><tr>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{preview.rows.map((row, rowIndex) => <tr key={rowIndex}>{preview.headers.map((header, index) => <td key={`${rowIndex}-${header}`}>{row[index] ?? '—'}</td>)}</tr>)}</tbody></table></div>}</section>
  </div>;
};

export default Reports;
