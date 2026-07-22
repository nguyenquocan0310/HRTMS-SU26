import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiChevronLeft, FiChevronRight, FiEye, FiFileText, FiX, FiXCircle } from 'react-icons/fi';
import { getFeePayments, getFeeProof, rejectFeePayment, verifyFeePayment, type FeePayment, type FeePaymentStatus } from '../../services/feePaymentService';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import { adminError, adminLabel, currency, dateTime } from '../../utils/adminLabels';
import styles from './EntryFees.module.scss';

const tabs: Array<{ status: FeePaymentStatus; label: string }> = [
  { status: 'PendingVerification', label: 'Chờ đối chiếu' }, { status: 'Verified', label: 'Đã xác nhận' }, { status: 'Rejected', label: 'Đã từ chối' },
];

const EntryFees = () => {
  const [status, setStatus] = useState<FeePaymentStatus>('PendingVerification');
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [tournamentId, setTournamentId] = useState<number | undefined>();
  const [items, setItems] = useState<FeePayment[]>([]);
  const [counts, setCounts] = useState<Record<FeePaymentStatus, number>>({ PendingVerification: 0, Verified: 0, Rejected: 0 });
  const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true); const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<FeePayment | null>(null); const [confirming, setConfirming] = useState<FeePayment | null>(null);
  const [rejecting, setRejecting] = useState<FeePayment | null>(null); const [reason, setReason] = useState('');
  const tournament = useMemo(() => tournaments.find((item) => item.tournamentId === tournamentId), [tournaments, tournamentId]);
interface FeeEntry {
  raceEntryId: number;
  raceId: number;
  horseName: string;
  jockeyName: string;
  status: string;
  entryFeeStatus: string;
  createdAt: string;
}

interface PendingFeeEntry extends Omit<FeeEntry, 'jockeyName'> {
  jockey?: {
    fullName?: string | null;
  };
}

interface RejectModalState {
  entryId: number;
  reason: string;
}

const EntryFees = () => {
  const [entries, setEntries] = useState<FeeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<RejectModalState | null>(null);

  const loadEntries = () => {
    setLoading(true);
    setError('');
    apiFetch<{ success: boolean; data: PendingFeeEntry[] }>('/admin/entries/pending-fee')
      .then((res) => setEntries(
        (res.data ?? []).map((entry) => ({
          ...entry,
          jockeyName: entry.jockey?.fullName?.trim() ?? '',
        }))
      ))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEntries(); }, []);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [result, ...countResults] = await Promise.all([
        getFeePayments({ status, tournamentId, page, pageSize: 20 }),
        ...tabs.map((tab) => getFeePayments({ status: tab.status, tournamentId, page: 1, pageSize: 1 })),
      ]);
      setItems(result.items ?? []); setTotalPages(Math.max(result.totalPages ?? Math.ceil(result.totalCount / result.pageSize), 1));
      setCounts({ PendingVerification: countResults[0].totalCount, Verified: countResults[1].totalCount, Rejected: countResults[2].totalCount });
    } catch (err) { setError(adminError(err, 'Không tải được danh sách lệ phí.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void getTournaments().then(setTournaments).catch((err) => setError(adminError(err))); }, []);
  useEffect(() => { void load(); }, [status, tournamentId, page]);
  const changeStatus = (next: FeePaymentStatus) => { setStatus(next); setPage(1); setDetail(null); };
  const openProof = async (payment: FeePayment) => {
    setActionId(payment.paymentId); setError('');
    try { const blob = await getFeeProof(payment.paymentId); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch (err) { setError(adminError(err, 'Không thể mở chứng từ.')); }
    finally { setActionId(null); }
  };
  const verify = async () => {
    if (!confirming) return; setActionId(confirming.paymentId); setError('');
    try { await verifyFeePayment(confirming.paymentId); setNotice(`Đã xác nhận lệ phí của ${confirming.horseName}. Cặp đấu đã được xác nhận tham gia.`); setConfirming(null); setDetail(null); await load(); }
    catch (err) { setError(adminError(err, 'Không thể xác nhận lệ phí.')); }
    finally { setActionId(null); }
  };
  const reject = async () => {
    if (!rejecting || reason.trim().length < 10) return; setActionId(rejecting.paymentId); setError('');
    try { await rejectFeePayment(rejecting.paymentId, reason.trim()); setNotice('Đã từ chối lệ phí và gửi yêu cầu nộp lại cho chủ ngựa.'); setRejecting(null); setDetail(null); setReason(''); await load(); }
    catch (err) { setError(adminError(err, 'Không thể từ chối lệ phí.')); }
    finally { setActionId(null); }
  };

  return <div className={styles.page}>
    <header><h1>Đối chiếu lệ phí</h1></header>
    {notice && <div className={styles.notice}>{notice}</div>}{error && <div className={styles.error}>{error}</div>}
    <section className={styles.card}><div className={styles.toolbar}><div className={styles.tabs}>{tabs.map((tab) => <button key={tab.status} className={status === tab.status ? styles.tabActive : styles.tab} onClick={() => changeStatus(tab.status)}>{tab.label}<span>{counts[tab.status]}</span></button>)}</div><label className={styles.tournamentSelect}>Giải đấu<select value={tournamentId ?? ''} onChange={(event) => { setTournamentId(event.target.value ? Number(event.target.value) : undefined); setPage(1); }}><option value="">Tất cả giải đấu</option>{tournaments.map((item) => <option value={item.tournamentId} key={item.tournamentId}>{item.name}</option>)}</select></label></div>
      {tournament && <div className={styles.tournamentInfo}><strong>{tournament.name}</strong><span>Hạn nộp lệ phí: {dateTime(tournament.paymentDeadline)}</span><span>Hạn hoàn lệ phí: {tournament.refundDeadline ? dateTime(tournament.refundDeadline) : 'Không hoàn'}</span></div>}
      <div className={styles.tableWrap}><table><thead><tr><th>Ngựa / Nài</th><th>Giải đấu</th><th>Số tiền</th><th>Hình thức</th><th>Mã đối chiếu</th><th>Nộp lúc</th><th>Chứng từ</th><th>Thao tác</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={8} className={styles.empty}>Đang tải hồ sơ lệ phí…</td></tr> : items.length === 0 ? <tr><td colSpan={8} className={styles.empty}>Không có khoản lệ phí {status === 'PendingVerification' ? 'chờ đối chiếu' : adminLabel(status).toLocaleLowerCase()}.</td></tr> : items.map((payment) => <tr key={payment.paymentId}><td><strong>{payment.horseName}</strong><small>Nài: {payment.jockeyName} · Chủ ngựa: {payment.ownerName}</small></td><td>{payment.tournamentName}</td><td>{currency(payment.amount)}</td><td>{adminLabel(payment.method)}</td><td>{payment.method === 'Cash' ? payment.receiptNo ?? '—' : payment.transferRef ?? '—'}</td><td>{dateTime(payment.submittedAt)}</td><td>{payment.hasProof ? <button className={styles.fileButton} onClick={() => void openProof(payment)} disabled={actionId === payment.paymentId}><FiFileText /> {payment.proofFileName ?? 'Mở chứng từ'}</button> : 'Không có'}</td><td><button className={styles.detailButton} onClick={() => setDetail(payment)}><FiEye /> Chi tiết</button></td></tr>)}
      </tbody></table></div>
      <div className={styles.pagination}><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}><FiChevronLeft /> Trước</button><span>Trang {page}/{totalPages}</span><button disabled={page === totalPages || loading} onClick={() => setPage((value) => value + 1)}>Sau <FiChevronRight /></button></div>
    </section>
    {detail && <><div className={styles.backdrop} onClick={() => setDetail(null)} /><aside className={styles.drawer}><div className={styles.drawerHeader}><div><h2>{detail.horseName}</h2><p>{detail.tournamentName} · Cặp đấu #{detail.pairingId}</p></div><button onClick={() => setDetail(null)} aria-label="Đóng chi tiết"><FiX /></button></div><dl><dt>Số tiền</dt><dd>{currency(detail.amount)}</dd><dt>Hình thức</dt><dd>{adminLabel(detail.method)}</dd><dt>Mã giao dịch / biên nhận</dt><dd>{detail.method === 'Cash' ? detail.receiptNo ?? '—' : detail.transferRef ?? '—'}</dd><dt>Nài ngựa</dt><dd>{detail.jockeyName}</dd><dt>Chủ ngựa</dt><dd>{detail.ownerName}</dd><dt>Nộp lúc</dt><dd>{dateTime(detail.submittedAt)}</dd><dt>Trạng thái lệ phí</dt><dd><span className={styles.status}>{adminLabel(detail.status)}</span></dd><dt>Trạng thái cặp đấu</dt><dd>{adminLabel(detail.pairingStatus)}</dd>{detail.verifiedAt && <><dt>Đã xác nhận lúc</dt><dd>{dateTime(detail.verifiedAt)}</dd></>}{detail.rejectReason && <><dt>Lý do từ chối</dt><dd>{detail.rejectReason}</dd></>}</dl>{detail.hasProof && <button className={styles.proofButton} onClick={() => void openProof(detail)}><FiFileText /> Mở chứng từ</button>}{detail.status === 'PendingVerification' && <div className={styles.drawerActions}><button className={styles.rejectButton} onClick={() => { setRejecting(detail); setReason(''); }}><FiXCircle /> Từ chối</button><button className={styles.verifyButton} onClick={() => setConfirming(detail)}><FiCheck /> Xác nhận lệ phí</button></div>}</aside></>}
    {confirming && <div className={styles.modalLayer}><div className={styles.modal}><h2>Xác nhận lệ phí</h2><p>Xác nhận chứng từ của <strong>{confirming.horseName}</strong>? Cặp đấu sẽ chuyển sang đã xác nhận tham gia.</p><div><button onClick={() => setConfirming(null)}>Hủy</button><button className={styles.verifyButton} disabled={actionId === confirming.paymentId} onClick={() => void verify()}>Xác nhận</button></div></div></div>}
    {rejecting && <div className={styles.modalLayer}><div className={styles.modal}><h2>Từ chối lệ phí</h2><p>Nêu rõ lý do để chủ ngựa có thể nộp lại chứng từ.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ít nhất 10 ký tự" rows={4} />{reason.length > 0 && reason.trim().length < 10 && <small className={styles.errorText}>Cần ít nhất 10 ký tự.</small>}<div><button onClick={() => setRejecting(null)}>Hủy</button><button className={styles.rejectButton} disabled={reason.trim().length < 10 || actionId === rejecting.paymentId} onClick={() => void reject()}>Từ chối lệ phí</button></div></div></div>}
  </div>;
};

export default EntryFees;
