import { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiChevronLeft, FiChevronRight, FiEye, FiFileText, FiX, FiXCircle } from 'react-icons/fi';
import {
  getAdminFeePairings,
  getFeeProof,
  rejectFeePayment,
  rejectUnpaidPairing,
  verifyFeePayment,
  type AdminFeePairing,
  type AdminFeePairingStatus,
} from '../../services/feePaymentService';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import { adminError, adminLabel, currency, dateTime } from '../../utils/adminLabels';
import styles from './EntryFees.module.scss';

const tabs: Array<{ status: AdminFeePairingStatus; label: string }> = [
  { status: 'All', label: 'Tất cả pairing' },
  { status: 'NoPayment', label: 'Chưa nộp phí' },
  { status: 'PendingVerification', label: 'Chờ đối chiếu' },
  { status: 'Verified', label: 'Đã xác nhận' },
  { status: 'Rejected', label: 'Đã từ chối phí' },
];

const EntryFees = () => {
  const [status, setStatus] = useState<AdminFeePairingStatus>('All');
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [tournamentId, setTournamentId] = useState<number | undefined>();
  const [items, setItems] = useState<AdminFeePairing[]>([]);
  const [counts, setCounts] = useState<Record<AdminFeePairingStatus, number>>({
    All: 0, NoPayment: 0, PendingVerification: 0, Verified: 0, Rejected: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<AdminFeePairing | null>(null);
  const [confirming, setConfirming] = useState<AdminFeePairing | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<AdminFeePairing | null>(null);
  const [rejectingUnpaid, setRejectingUnpaid] = useState<AdminFeePairing | null>(null);
  const [reason, setReason] = useState('');
  const tournament = useMemo(
    () => tournaments.find((item) => item.tournamentId === tournamentId),
    [tournaments, tournamentId],
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [result, ...countResults] = await Promise.all([
        getAdminFeePairings({ status, tournamentId, page, pageSize: 20 }),
        ...tabs.map((tab) => getAdminFeePairings({
          status: tab.status, tournamentId, page: 1, pageSize: 1,
        })),
      ]);
      setItems(result.items ?? []);
      setTotalPages(Math.max(result.totalPages ?? Math.ceil(result.totalCount / result.pageSize), 1));
      setCounts({
        All: countResults[0].totalCount,
        NoPayment: countResults[1].totalCount,
        PendingVerification: countResults[2].totalCount,
        Verified: countResults[3].totalCount,
        Rejected: countResults[4].totalCount,
      });
    } catch (err) {
      setError(adminError(err, 'Không tải được danh sách pairing và lệ phí.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void getTournaments().then(setTournaments).catch((err) => setError(adminError(err)));
  }, []);
  useEffect(() => { void load(); }, [status, tournamentId, page]);

  const changeStatus = (next: AdminFeePairingStatus) => {
    setStatus(next);
    setPage(1);
    setDetail(null);
  };

  const openProof = async (pairing: AdminFeePairing) => {
    if (!pairing.paymentId) return;
    setActionKey(`proof-${pairing.paymentId}`);
    setError('');
    try {
      const blob = await getFeeProof(pairing.paymentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(adminError(err, 'Không thể mở chứng từ.'));
    } finally {
      setActionKey(null);
    }
  };

  const verify = async () => {
    if (!confirming?.paymentId) return;
    setActionKey(`verify-${confirming.paymentId}`);
    setError('');
    try {
      await verifyFeePayment(confirming.paymentId);
      setNotice(`Đã xác nhận lệ phí của ${confirming.horseName}. Cặp đấu đã đủ điều kiện tham gia.`);
      setConfirming(null);
      setDetail(null);
      await load();
    } catch (err) {
      setError(adminError(err, 'Không thể xác nhận lệ phí.'));
    } finally {
      setActionKey(null);
    }
  };

  const rejectPayment = async () => {
    if (!rejectingPayment?.paymentId || reason.trim().length < 10) return;
    setActionKey(`reject-payment-${rejectingPayment.paymentId}`);
    setError('');
    try {
      await rejectFeePayment(rejectingPayment.paymentId, reason.trim());
      setNotice('Đã từ chối lệ phí và gửi yêu cầu nộp lại cho chủ ngựa.');
      setRejectingPayment(null);
      setDetail(null);
      setReason('');
      await load();
    } catch (err) {
      setError(adminError(err, 'Không thể từ chối lệ phí.'));
    } finally {
      setActionKey(null);
    }
  };

  const rejectUnpaid = async () => {
    if (!rejectingUnpaid || reason.trim().length < 10) return;
    setActionKey(`reject-pairing-${rejectingUnpaid.pairingId}`);
    setError('');
    try {
      await rejectUnpaidPairing(rejectingUnpaid.pairingId, reason.trim());
      setNotice(`Đã từ chối pairing của ${rejectingUnpaid.horseName} vì chưa hoàn tất lệ phí.`);
      setRejectingUnpaid(null);
      setDetail(null);
      setReason('');
      await load();
    } catch (err) {
      setError(adminError(err, 'Không thể từ chối pairing chưa nộp phí.'));
    } finally {
      setActionKey(null);
    }
  };

  const paymentState = (pairing: AdminFeePairing) =>
    pairing.paymentStatus ? adminLabel(pairing.paymentStatus) : 'Chưa nộp phí';

  return <div className={styles.page}>
    <header><h1>Đối chiếu lệ phí</h1></header>
    {notice && <div className={styles.notice}>{notice}</div>}
    {error && <div className={styles.error}>{error}</div>}
    <section className={styles.card}>
      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {tabs.map((tab) => <button key={tab.status} className={status === tab.status ? styles.tabActive : styles.tab} onClick={() => changeStatus(tab.status)}>{tab.label}<span>{counts[tab.status]}</span></button>)}
        </div>
        <label className={styles.tournamentSelect}>Giải đấu
          <select value={tournamentId ?? ''} onChange={(event) => { setTournamentId(event.target.value ? Number(event.target.value) : undefined); setPage(1); }}>
            <option value="">Tất cả giải đấu</option>
            {tournaments.map((item) => <option value={item.tournamentId} key={item.tournamentId}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {tournament && <div className={styles.tournamentInfo}><strong>{tournament.name}</strong><span>Hạn nộp lệ phí: {dateTime(tournament.paymentDeadline)}</span><span>Hạn hoàn lệ phí: {tournament.refundDeadline ? dateTime(tournament.refundDeadline) : 'Không hoàn'}</span></div>}
      <div className={styles.tableWrap}><table><thead><tr><th>Ngựa / Nài</th><th>Giải đấu</th><th>Trạng thái cặp</th><th>Lệ phí</th><th>Nộp lúc</th><th>Chứng từ</th><th>Thao tác</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={7} className={styles.empty}>Đang tải pairing…</td></tr> : items.length === 0 ? <tr><td colSpan={7} className={styles.empty}>Không có pairing phù hợp với bộ lọc.</td></tr> : items.map((pairing) => <tr key={pairing.pairingId}>
          <td><strong>{pairing.horseName}</strong><small>Nài: {pairing.jockeyName} · Chủ ngựa: {pairing.ownerName}</small></td>
          <td>{pairing.tournamentName}</td>
          <td><span className={styles.status}>{adminLabel(pairing.pairingStatus)}</span></td>
          <td>{pairing.amount === null ? <><strong>Chưa nộp phí</strong><small>{paymentState(pairing)}</small></> : <><strong>{currency(pairing.amount)}</strong><small>{pairing.method ? adminLabel(pairing.method) : '—'} · {paymentState(pairing)}</small></>}</td>
          <td>{pairing.submittedAt ? dateTime(pairing.submittedAt) : '—'}</td>
          <td>{pairing.hasProof && pairing.paymentId ? <button className={styles.fileButton} onClick={() => void openProof(pairing)} disabled={actionKey === `proof-${pairing.paymentId}`}><FiFileText /> {pairing.proofFileName ?? 'Mở chứng từ'}</button> : pairing.paymentId ? 'Chưa có file' : 'Chưa nộp'}</td>
          <td><button className={styles.detailButton} onClick={() => setDetail(pairing)}><FiEye /> Chi tiết</button></td>
        </tr>)}
      </tbody></table></div>
      <div className={styles.pagination}><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}><FiChevronLeft /> Trước</button><span>Trang {page}/{totalPages}</span><button disabled={page === totalPages || loading} onClick={() => setPage((value) => value + 1)}>Sau <FiChevronRight /></button></div>
    </section>

    {detail && <><div className={styles.backdrop} onClick={() => setDetail(null)} /><aside className={styles.drawer}><div className={styles.drawerHeader}><div><h2>{detail.horseName}</h2><p>{detail.tournamentName} · Cặp đấu #{detail.pairingId}</p></div><button onClick={() => setDetail(null)} aria-label="Đóng chi tiết"><FiX /></button></div><dl>
      <dt>Nài ngựa</dt><dd>{detail.jockeyName}</dd><dt>Chủ ngựa</dt><dd>{detail.ownerName}</dd><dt>Trạng thái cặp</dt><dd><span className={styles.status}>{adminLabel(detail.pairingStatus)}</span></dd><dt>Trạng thái lệ phí</dt><dd>{paymentState(detail)}</dd><dt>Số tiền</dt><dd>{detail.amount === null ? 'Chưa nộp' : currency(detail.amount)}</dd><dt>Hình thức</dt><dd>{detail.method ? adminLabel(detail.method) : '—'}</dd><dt>Mã giao dịch / biên nhận</dt><dd>{detail.method === 'Cash' ? detail.receiptNo ?? '—' : detail.method === 'Transfer' ? detail.transferRef ?? '—' : '—'}</dd><dt>Nộp lúc</dt><dd>{detail.submittedAt ? dateTime(detail.submittedAt) : 'Chưa nộp'}</dd>
      {detail.verifiedAt && <><dt>Đã xác nhận lúc</dt><dd>{dateTime(detail.verifiedAt)}</dd></>}{detail.rejectReason && <><dt>Lý do từ chối phí</dt><dd>{detail.rejectReason}</dd></>}{detail.pairingResponseReason && <><dt>Ghi chú pairing</dt><dd>{detail.pairingResponseReason}</dd></>}
    </dl>
    {detail.hasProof && detail.paymentId && <button className={styles.proofButton} onClick={() => void openProof(detail)}><FiFileText /> Mở chứng từ</button>}
    {detail.paymentStatus === 'PendingVerification' && detail.paymentId && <div className={styles.drawerActions}><button className={styles.rejectButton} onClick={() => { setRejectingPayment(detail); setReason(''); }}><FiXCircle /> Từ chối lệ phí</button><button className={styles.verifyButton} onClick={() => setConfirming(detail)}><FiCheck /> Xác nhận lệ phí</button></div>}
    {detail.canRejectUnpaid && <div className={styles.drawerActions}><button className={styles.rejectButton} onClick={() => { setRejectingUnpaid(detail); setReason(''); }}><FiXCircle /> Từ chối pairing chưa nộp phí</button></div>}
    </aside></>}

    {confirming && <div className={styles.modalLayer}><div className={styles.modal}><h2>Xác nhận lệ phí</h2><p>Xác nhận hồ sơ của <strong>{confirming.horseName}</strong>? Cặp đấu sẽ đủ điều kiện tham gia.</p><div><button onClick={() => setConfirming(null)}>Hủy</button><button className={styles.verifyButton} disabled={actionKey !== null} onClick={() => void verify()}>Xác nhận</button></div></div></div>}
    {rejectingPayment && <ReasonModal title="Từ chối lệ phí" description="Nêu rõ lý do để chủ ngựa có thể nộp lại chứng từ." reason={reason} onReasonChange={setReason} onCancel={() => setRejectingPayment(null)} onConfirm={() => void rejectPayment()} disabled={reason.trim().length < 10 || actionKey !== null} confirm="Từ chối lệ phí" />}
    {rejectingUnpaid && <ReasonModal title="Từ chối pairing chưa nộp phí" description={`Pairing của ${rejectingUnpaid.horseName} sẽ bị từ chối và không còn đủ điều kiện tham gia giải. Chủ ngựa có thể tạo pairing mới nếu cần.`} reason={reason} onReasonChange={setReason} onCancel={() => setRejectingUnpaid(null)} onConfirm={() => void rejectUnpaid()} disabled={reason.trim().length < 10 || actionKey !== null} confirm="Từ chối pairing" />}
  </div>;
};

const ReasonModal = ({ title, description, reason, onReasonChange, onCancel, onConfirm, disabled, confirm }: { title: string; description: string; reason: string; onReasonChange: (value: string) => void; onCancel: () => void; onConfirm: () => void; disabled: boolean; confirm: string }) => <div className={styles.modalLayer}><div className={styles.modal}><h2>{title}</h2><p>{description}</p><textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Ít nhất 10 ký tự" rows={4} />{reason.length > 0 && reason.trim().length < 10 && <small className={styles.errorText}>Cần ít nhất 10 ký tự.</small>}<div><button onClick={onCancel}>Hủy</button><button className={styles.rejectButton} disabled={disabled} onClick={onConfirm}>{confirm}</button></div></div></div>;

export default EntryFees;
