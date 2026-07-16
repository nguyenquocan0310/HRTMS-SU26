/* eslint-disable react-hooks/set-state-in-effect -- Selected scope changes require server-side summary refreshes. */
import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import {
  getRacePayoutSummary,
  getRacePurseSummary,
  getTournamentPurseSummary,
  updatePayoutStatus,
  type RacePayoutSummary,
  type RacePurseSummary,
  type TournamentPurseSummary,
} from '../../services/pursePayoutService';
import styles from './PursePayouts.module.scss';

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value ?? 0);
const payoutLabel = (status: string) => status === 'Paid' ? 'Đã chi trả' : status === 'Unpaid' ? 'Chờ chi trả' : 'Chưa thể chi trả';
const raceStatusLabel = (status: string) => ({ Official: 'Đã công bố kết quả', Cancelled: 'Đã hủy', Upcoming: 'Sắp diễn ra', Live: 'Đang diễn ra', Unofficial: 'Chờ xác nhận kết quả' }[status] ?? 'Chưa có dữ liệu');

interface RaceOption { raceId: number; label: string; }

const PursePayouts = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [tournamentSummary, setTournamentSummary] = useState<TournamentPurseSummary | null>(null);
  const [raceSummary, setRaceSummary] = useState<RacePurseSummary | null>(null);
  const [payoutSummary, setPayoutSummary] = useState<RacePayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [raceLoading, setRaceLoading] = useState(false);
  const [updatingPayoutId, setUpdatingPayoutId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const raceOptions = useMemo<RaceOption[]>(() => {
    const selected = tournaments.find((item) => item.tournamentId === selectedTournamentId);
    return selected?.rounds.flatMap((round) => round.races.map((race) => ({ raceId: race.raceId, label: `${round.name} — Cuộc đua #${race.raceNumber}` }))) ?? [];
  }, [tournaments, selectedTournamentId]);

  useEffect(() => {
    getTournaments().then((items) => { setTournaments(items); setSelectedTournamentId(items[0]?.tournamentId ?? null); }).catch(() => setError('Không tải được danh sách giải đấu. Vui lòng thử lại.')).finally(() => setLoading(false));
  }, []);

  const loadTournament = async (tournamentId: number) => {
    setLoading(true); setError(''); setMessage('');
    try { setTournamentSummary(await getTournamentPurseSummary(tournamentId)); }
    catch (requestError) { setTournamentSummary(null); setError(requestError instanceof Error ? requestError.message : 'Không tải được tổng hợp quỹ thưởng.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedTournamentId) void loadTournament(selectedTournamentId); }, [selectedTournamentId]);
  useEffect(() => { setSelectedRaceId(raceOptions[0]?.raceId ?? null); }, [raceOptions]);

  const loadRace = async (raceId: number) => {
    setRaceLoading(true); setError('');
    try {
      const [summary, payouts] = await Promise.all([getRacePurseSummary(raceId), getRacePayoutSummary(raceId)]);
      setRaceSummary(summary); setPayoutSummary(payouts);
    } catch (requestError) {
      setRaceSummary(null); setPayoutSummary(null);
      setError(requestError instanceof Error ? requestError.message : 'Không tải được chi tiết chi trả.');
    } finally { setRaceLoading(false); }
  };

  useEffect(() => { if (selectedRaceId) void loadRace(selectedRaceId); else { setRaceSummary(null); setPayoutSummary(null); } }, [selectedRaceId]);

  const refresh = async () => {
    if (selectedTournamentId) await loadTournament(selectedTournamentId);
    if (selectedRaceId) await loadRace(selectedRaceId);
  };

  const handleChangeStatus = async (payoutId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'Paid' ? 'Unpaid' : 'Paid';
    setUpdatingPayoutId(payoutId); setError(''); setMessage('');
    try {
      await updatePayoutStatus(payoutId, nextStatus);
      setMessage(nextStatus === 'Paid' ? 'Đã đánh dấu khoản thưởng là đã chi trả.' : 'Đã chuyển khoản thưởng về trạng thái chờ chi trả.');
      await refresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật trạng thái chi trả.'); }
    finally { setUpdatingPayoutId(null); }
  };

  return <div className={styles.container}>
    <div className={styles.header}><div><h1 className={styles.heading}>Quỹ thưởng và chi trả</h1><p className={styles.subtext}>Số liệu tổng hợp được lấy trực tiếp từ hệ thống, không tự tính lại ở giao diện.</p></div><div className={styles.headerActions}><button type="button" className={styles.ghostBtn} onClick={() => void refresh()} disabled={loading || raceLoading}><FiRefreshCw size={15} /> Cập nhật</button></div></div>
    <div className={styles.filterSection}><label className={styles.label} htmlFor="purse-tournament">Giải đấu</label><select id="purse-tournament" className={styles.select} value={selectedTournamentId ?? ''} onChange={(event) => setSelectedTournamentId(Number(event.target.value))}>{tournaments.map((item) => <option key={item.tournamentId} value={item.tournamentId}>{item.name}</option>)}</select></div>
    {error && <div className={styles.errorBox} role="alert">{error}</div>}{message && <div className={styles.successBox}>{message}</div>}
    {loading ? <p className={styles.emptyCell}>Đang tải tổng hợp quỹ thưởng...</p> : !tournamentSummary ? <p className={styles.emptyCell}>Chưa có dữ liệu quỹ thưởng.</p> : <>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}><span>Tổng quỹ</span><strong>{formatMoney(tournamentSummary.totalFund)}</strong></div>
        <div className={styles.summaryItem}><span>Đã chi trả</span><strong>{formatMoney(tournamentSummary.paidAmount)}</strong></div>
        <div className={styles.summaryItem}><span>Chờ chi trả</span><strong>{formatMoney(tournamentSummary.pendingAmount)}</strong></div>
        <div className={styles.summaryItem}><span>Còn lại</span><strong>{formatMoney(tournamentSummary.remainingAmount)}</strong></div>
        <div className={styles.summaryItem}><span>Tiến độ</span><strong>{tournamentSummary.paidRaceCount}/{tournamentSummary.totalRaceCount} cuộc đua đã chi trả</strong><small>{tournamentSummary.completedRoundCount}/{tournamentSummary.totalRoundCount} vòng đã hoàn thành</small></div>
      </div>
      {tournamentSummary.hasDiscrepancy && <div className={styles.errorBox}>Dữ liệu quỹ thưởng có chênh lệch. Vui lòng kiểm tra lại các khoản chi trả.</div>}
      <section className={styles.section}><h2 className={styles.sectionTitle}>Theo vòng đấu</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Vòng đấu</th><th>Quỹ được phân bổ</th><th>Đã chi trả</th><th>Chờ chi trả</th><th>Còn lại</th><th>Tiến độ</th></tr></thead><tbody>{tournamentSummary.rounds.length === 0 ? <tr><td colSpan={6} className={styles.emptyCell}>Chưa có vòng đấu.</td></tr> : tournamentSummary.rounds.map((round) => <tr key={round.roundId}><td>{round.roundName}</td><td>{formatMoney(round.allocatedFund)}</td><td>{formatMoney(round.paidAmount)}</td><td>{formatMoney(round.pendingAmount)}</td><td>{formatMoney(round.remainingAmount)}</td><td>{round.paidRaceCount}/{round.totalRaceCount} cuộc đua đã chi trả</td></tr>)}</tbody></table></div></section>
      <section className={styles.section}><h2 className={styles.sectionTitle}>Chi tiết theo cuộc đua</h2><select className={styles.select} value={selectedRaceId ?? ''} onChange={(event) => setSelectedRaceId(Number(event.target.value))}>{raceOptions.map((race) => <option key={race.raceId} value={race.raceId}>{race.label}</option>)}</select>
        {raceLoading ? <p className={styles.emptyCell}>Đang tải chi tiết cuộc đua...</p> : !raceSummary || !payoutSummary ? <p className={styles.emptyCell}>Chưa có dữ liệu cuộc đua.</p> : <><p className={styles.sectionSubtext}>{raceStatusLabel(raceSummary.resultStatus)} · {payoutLabel(raceSummary.payoutStatus)} · Quỹ phân bổ: {formatMoney(raceSummary.allocatedFund)}</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Người nhận</th><th>Vai trò</th><th>Ngựa</th><th>Thứ hạng</th><th>Số tiền</th><th>Trạng thái</th><th></th></tr></thead><tbody>{payoutSummary.payouts.length === 0 ? <tr><td colSpan={7} className={styles.emptyCell}>Cuộc đua chưa có khoản chi trả. Chỉ cuộc đua đã công bố kết quả mới sinh khoản thưởng.</td></tr> : payoutSummary.payouts.map((payout) => <tr key={payout.pursePayoutId}><td>{payout.recipientName}</td><td>{payout.role === 'Owner' ? 'Chủ ngựa' : 'Nài ngựa'}</td><td>{payout.horseName}</td><td>{payout.finishPosition ?? '—'}</td><td>{formatMoney(payout.calculatedAmount)}</td><td><span className={`${styles.statusBadge} ${payout.payoutStatus === 'Paid' ? styles.paid : styles.unpaid}`}>{payoutLabel(payout.payoutStatus)}</span></td><td><button type="button" className={styles.statusBtn} disabled={updatingPayoutId === payout.pursePayoutId} onClick={() => void handleChangeStatus(payout.pursePayoutId, payout.payoutStatus)}>{updatingPayoutId === payout.pursePayoutId ? 'Đang cập nhật...' : payout.payoutStatus === 'Paid' ? 'Chuyển chờ chi trả' : 'Đánh dấu đã chi trả'}</button></td></tr>)}</tbody></table></div></>}
      </section>
    </>}
  </div>;
};

export default PursePayouts;
