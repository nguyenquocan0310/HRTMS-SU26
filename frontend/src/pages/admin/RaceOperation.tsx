import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiArrowRight, FiCheck, FiFlag, FiMove, FiRefreshCw } from 'react-icons/fi';
import { getTournaments, type RoundResponse, type TournamentResponse } from '../../services/tournamentService';
import { autoAllocate, finalizeRound, getRaceSchedule, getRoundWaitlist, moveRaceEntry, previewAutoAllocate, type AutoAllocateResult, type FinalizeResult, type RaceSchedule, type ScheduledEntry, type WaitlistEntry } from '../../services/schedulingService';
import { adminError, adminLabel, dateTime } from '../../utils/adminLabels';
import styles from './RaceOperation.module.scss';

const RaceOperations = () => {
  const [search, setSearch] = useSearchParams();
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [schedules, setSchedules] = useState<RaceSchedule[]>([]); const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [preview, setPreview] = useState<AutoAllocateResult | null>(null); const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const [loading, setLoading] = useState(true); const [loadingRound, setLoadingRound] = useState(false); const [working, setWorking] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [allocateConfirm, setAllocateConfirm] = useState(false); const [finalizeConfirm, setFinalizeConfirm] = useState(false); const [move, setMove] = useState<{ entry: ScheduledEntry; sourceRaceId: number; targetRaceId: number } | null>(null);
  const selectedTournamentId = Number(search.get('tournamentId')) || null; const selectedRoundId = Number(search.get('roundId')) || null;
  const tournament = useMemo(() => tournaments.find((item) => item.tournamentId === selectedTournamentId) ?? null, [tournaments, selectedTournamentId]);
  const round = useMemo<RoundResponse | null>(() => tournament?.rounds.find((item) => item.roundId === selectedRoundId) ?? null, [tournament, selectedRoundId]);
  const setSelection = (tournamentId?: number, roundId?: number) => { const next = new URLSearchParams(); if (tournamentId) next.set('tournamentId', String(tournamentId)); if (roundId) next.set('roundId', String(roundId)); setSearch(next, { replace: true }); };
  useEffect(() => { void getTournaments().then((data) => { setTournaments(data); const initialTournament = data.find((item) => item.tournamentId === selectedTournamentId) ?? data[0]; if (!initialTournament) return; const initialRound = initialTournament.rounds.find((item) => item.roundId === selectedRoundId) ?? initialTournament.rounds[0]; if (initialRound && (!selectedTournamentId || !selectedRoundId || initialTournament.tournamentId !== selectedTournamentId)) setSelection(initialTournament.tournamentId, initialRound.roundId); }).catch((err) => setError(adminError(err, 'Không tải được danh sách giải đấu.'))).finally(() => setLoading(false)); }, []);
  const refreshRound = async () => {
    if (!round) { setSchedules([]); setWaitlist([]); return; }
    setLoadingRound(true); setError('');
    try { const [races, waiting] = await Promise.all([Promise.all(round.races.map((race) => getRaceSchedule(race.raceId))), getRoundWaitlist(round.roundId)]); setSchedules(races.sort((a, b) => a.raceNumber - b.raceNumber)); setWaitlist(waiting); }
    catch (err) { setError(adminError(err, 'Không tải được thông tin vòng đấu.')); }
    finally { setLoadingRound(false); }
  };
  useEffect(() => { setPreview(null); setFinalizeResult(null); void refreshRound(); }, [round?.roundId]);
  const showPreview = async () => { if (!round) return; setWorking(true); setError(''); try { setPreview(await previewAutoAllocate(round.roundId)); setNotice('Đã tạo bản xem trước. Kết quả này chưa được lưu vào hệ thống.'); } catch (err) { setError(adminError(err)); } finally { setWorking(false); } };
  const allocate = async () => { if (!round) return; setWorking(true); setAllocateConfirm(false); setError(''); try { const result = await autoAllocate(round.roundId); setPreview(result); setNotice(`Đã chốt danh sách: ${result.allocatedCount} cặp được phân vào cuộc đua, ${result.waitlistedCount} cặp trong danh sách chờ.`); await refreshRound(); } catch (err) { setError(adminError(err)); } finally { setWorking(false); } };
  const finalize = async () => { if (!round) return; setWorking(true); setFinalizeConfirm(false); setError(''); try { const result = await finalizeRound(round.roundId); setFinalizeResult(result); setPreview(result.allocation); setNotice('Đã hoàn tất xử lý vòng đấu. Xem chi tiết các cuộc đua được bốc thăm và bị bỏ qua bên dưới.'); await refreshRound(); } catch (err) { setError(adminError(err)); } finally { setWorking(false); } };
  const submitMove = async () => { if (!move || move.sourceRaceId === move.targetRaceId) return; setWorking(true); setError(''); try { await moveRaceEntry(move.entry.raceEntryId, move.targetRaceId); setMove(null); setNotice(`Đã chuyển ${move.entry.horseName} sang cuộc đua đích.`); await refreshRound(); } catch (err) { setError(adminError(err)); } finally { setWorking(false); } };
  const capacity = tournament?.raceCapacity ?? schedules[0]?.raceCapacity ?? null;
  const hasAllocation = schedules.some((race) => race.entries.length > 0);
  const allDrawn = schedules.length > 0 && schedules.every((race) => race.isPostPositionDrawn);

  return <div className={styles.page}>
    <header className={styles.header}><div><h1>Phân cuộc đua</h1></div><button className={styles.secondary} onClick={() => void refreshRound()} disabled={loadingRound}><FiRefreshCw /> Làm mới</button></header>
    {notice && <div className={styles.notice}>{notice}</div>}{error && <div className={styles.error}>{error}</div>}
    <section className={styles.card}><div className={styles.selectors}><label>Giải đấu<select value={selectedTournamentId ?? ''} onChange={(event) => { const id = Number(event.target.value); const next = tournaments.find((item) => item.tournamentId === id); setSelection(id, next?.rounds[0]?.roundId); }}><option value="">-- Chọn giải đấu --</option>{tournaments.map((item) => <option key={item.tournamentId} value={item.tournamentId}>{item.name}</option>)}</select></label><label>Vòng đấu<select value={selectedRoundId ?? ''} disabled={!tournament} onChange={(event) => setSelection(selectedTournamentId ?? undefined, Number(event.target.value))}><option value="">-- Chọn vòng đấu --</option>{tournament?.rounds.map((item) => <option key={item.roundId} value={item.roundId}>{item.name} · {item.races.length} cuộc đua · {adminLabel(item.status)}</option>)}</select></label></div>
      {tournament && <div className={styles.venue}><strong>{tournament.venueName ?? 'Chưa gán trường đua'}{tournament.venueCity ? ` · ${tournament.venueCity}` : ''}</strong><span>Mặt sân: {adminLabel(tournament.trackType)}</span><span>Số làn: {tournament.laneCount ?? '—'}</span><span>Chiều dài: {tournament.trackLengthMeters ? `${tournament.trackLengthMeters.toLocaleString('vi-VN')} m` : '—'}</span><span>Sức chứa mỗi cuộc đua: {capacity ?? '—'}</span></div>}
    </section>
    {loading || loadingRound ? <section className={styles.card}><p className={styles.empty}>Đang tải dữ liệu vòng đấu…</p></section> : !round ? <section className={styles.card}><p className={styles.empty}>Chọn giải đấu và vòng đấu để bắt đầu điều hành.</p></section> : <>
      <section className={styles.progress}>{[[true, 'Lệ phí đã sẵn sàng'], [hasAllocation, 'Phân vào cuộc đua đã chốt'], [allDrawn, 'Bốc thăm vị trí xuất phát'], [schedules.some((race) => race.status === 'Official'), 'Trọng tài kiểm tra từng cuộc đua']].map(([done, label]) => <div key={String(label)} className={done ? styles.done : styles.pending}><FiCheck /> {label}</div>)}</section>
      <section className={styles.card}><div className={styles.actionHeader}><div><h2>Phân cặp vào cuộc đua</h2></div><div className={styles.actionButtons}><button className={styles.secondary} disabled={working} onClick={() => void showPreview()}>Xem trước</button><button className={styles.primary} disabled={working || !preview || preview.allocatedCount === 0} onClick={() => setAllocateConfirm(true)}><FiFlag /> Chốt danh sách</button><button className={styles.finalize} disabled={working} onClick={() => setFinalizeConfirm(true)}>Hoàn tất phân race và bốc thăm</button></div></div>
        {preview && <div className={styles.preview}><div className={styles.stats}>{[['Pool đủ điều kiện', preview.poolSize], ['Sức chứa mỗi cuộc đua', preview.capacityPerRace], ['Số cuộc đua', preview.raceCount], ['Tổng sức chứa', preview.totalCapacity], ['Được phân', preview.allocatedCount], ['Danh sách chờ', preview.waitlistedCount]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div>{preview.warnings.length > 0 && <div className={styles.warnings}>{preview.warnings.map((warning) => <p key={warning}><FiAlertTriangle /> {warning}</p>)}</div>}<div className={styles.previewGrid}><div><h3>Danh sách đủ điều kiện</h3>{preview.selectedPool.length === 0 ? <p className={styles.muted}>Chưa có cặp đấu đủ điều kiện (đã xác nhận lệ phí).</p> : <ol>{preview.selectedPool.map((entry) => <li key={entry.pairingId}><span><strong>{entry.horseName}</strong><small>Nài: {entry.jockeyName}</small></span><time>{dateTime(entry.feeVerifiedAt)}</time></li>)}</ol>}</div><div><h3>Sức chứa dự kiến</h3>{preview.races.map((race) => <p className={styles.racePreview} key={race.raceId}>Cuộc đua #{race.raceNumber} · {dateTime(race.scheduledTime)} <strong>{race.entryCount}/{preview.capacityPerRace}</strong></p>)}<small>Vị trí mỗi ngựa trong từng cuộc đua chỉ được xác định khi chốt danh sách.</small></div></div></div>}
      </section>
      <section className={styles.card}><div className={styles.sectionTitle}><div><h2>Danh sách chờ <span>{waitlist.length}</span></h2></div></div>{waitlist.length === 0 ? <p className={styles.empty}>Không có cặp đấu nào phải chờ.</p> : <ol className={styles.waitlist}>{waitlist.map((entry) => <li key={entry.pairingId}><b>{entry.position}</b><span><strong>{entry.horseName}</strong><small>Cặp đấu #{entry.pairingId} · Đã xác nhận lệ phí: {dateTime(entry.feeVerifiedAt)}</small></span></li>)}</ol>}</section>
      <section className={styles.raceGrid}>{schedules.map((race) => <article className={styles.raceCard} key={race.raceId}><header><div><h2>Cuộc đua #{race.raceNumber}</h2><p>{dateTime(race.scheduledTime)}</p></div><span>{race.entries.length}/{race.raceCapacity ?? capacity ?? '—'}</span></header>{race.entries.length === 0 ? <p className={styles.empty}>Chưa có ngựa nào trong cuộc đua này.</p> : <ul>{race.entries.slice().sort((a,b) => (a.postPosition ?? 999) - (b.postPosition ?? 999)).map((entry) => <li key={entry.raceEntryId}><span className={styles.position}>{entry.postPosition ?? '—'}</span><span><strong>{entry.horseName}</strong><small>Nài: {entry.jockeyName} · {adminLabel(entry.status)}</small></span>{!race.isPostPositionDrawn && <button onClick={() => setMove({ entry, sourceRaceId: race.raceId, targetRaceId: 0 })}><FiMove /> Chuyển</button>}</li>)}</ul>}<footer>{race.isPostPositionDrawn ? 'Đã bốc thăm vị trí xuất phát.' : 'Chưa bốc thăm — vị trí xuất phát để trống.'}</footer></article>)}</section>
      {finalizeResult && <section className={styles.card}><h2>Kết quả hoàn tất vòng</h2><div className={styles.resultGrid}><div><h3>Phân cuộc đua</h3><p>Đã phân {finalizeResult.allocation.allocatedCount}/{finalizeResult.allocation.poolSize} cặp; danh sách chờ {finalizeResult.allocation.waitlistedCount}.</p></div><div><h3>Bốc thăm thành công</h3>{finalizeResult.draws.length === 0 ? <p>Chưa có cuộc đua nào được bốc thăm.</p> : finalizeResult.draws.map((draw) => <p key={draw.raceId}>Cuộc đua #{schedules.find((race) => race.raceId === draw.raceId)?.raceNumber ?? draw.raceId}: {draw.totalEntries} ngựa đã bốc thăm.</p>)}</div><div><h3>Cuộc đua được bỏ qua</h3>{finalizeResult.skippedDraws.length === 0 ? <p>Không có.</p> : finalizeResult.skippedDraws.map((item) => <p key={item.raceId}>Cuộc đua #{item.raceNumber}: {adminLabel(item.reason)}</p>)}</div></div></section>}
    </>}
    {allocateConfirm && <Modal title="Chốt danh sách và phân cuộc đua" onCancel={() => setAllocateConfirm(false)} onConfirm={() => void allocate()} confirm="Chốt phân cuộc đua" loading={working}>Hệ thống sẽ lưu phân bổ cho toàn bộ vòng đấu và danh sách chờ. Bạn có chắc chắn muốn tiếp tục?</Modal>}
    {finalizeConfirm && <Modal title="Hoàn tất phân race và bốc thăm" onCancel={() => setFinalizeConfirm(false)} onConfirm={() => void finalize()} confirm="Hoàn tất" loading={working}>Hệ thống sẽ phân toàn bộ cặp đủ điều kiện và bốc thăm độc lập từng cuộc đua. Nếu một cuộc đua không đủ điều kiện, các phần đã hoàn thành vẫn được giữ lại.</Modal>}
    {move && <div className={styles.modalLayer}><div className={styles.modal}><h2>Chuyển ngựa sang cuộc đua khác</h2><p>Chỉ có thể chuyển trong cùng vòng và trước khi bốc thăm.</p><label>Cuộc đua đích<select value={move.targetRaceId} onChange={(event) => setMove({ ...move, targetRaceId: Number(event.target.value) })}><option value="0">-- Chọn cuộc đua --</option>{schedules.filter((race) => race.raceId !== move.sourceRaceId).map((race) => <option key={race.raceId} value={race.raceId}>Cuộc đua #{race.raceNumber} · {race.entries.length}/{race.raceCapacity ?? capacity ?? '—'}</option>)}</select></label><div><button className={styles.secondary} onClick={() => setMove(null)}>Hủy</button><button className={styles.primary} disabled={working || !move.targetRaceId} onClick={() => void submitMove()}><FiArrowRight /> Chuyển cuộc đua</button></div></div></div>}
  </div>;

  const handleDraw = async () => {
    if (!selectedRaceId) {
      return;
    }

    setDrawing(true);
    setActionMsg('');
    setActionError('');

    try {
      await drawPostPositions(selectedRaceId);
      setActionMsg('Bốc thăm thành công!');
      reloadEntries(selectedRaceId);
      await reloadTournamentList();
      reloadUnallocatedPairings();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Bốc thăm thất bại.'
      );
    } finally {
      setDrawing(false);
    }
  };

  const selectedRace = useMemo(
    () =>
      races.find((race) => race.id === selectedRaceId) ?? null,
    [races, selectedRaceId]
  );

  const isDrawn = selectedRace?.isDrawn ?? false;
  const selectedRaceStatus =
    selectedRace?.status?.trim().toLowerCase() ?? '';

  const canAllocateToSelectedRace =
    selectedRaceStatus === 'upcoming' && !isDrawn;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>
          System operations and governance
        </p>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Race Operations</h2>
        <p className={styles.sectionDesc}>
          Allocate pairing đã confirmed vào race và bốc thăm post
          position theo Module E.
        </p>
      </div>

      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Tournament</label>

            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={selectedTournamentId ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSelectedTournamentId(value > 0 ? value : null);
                  setActionMsg('');
                  setActionError('');
                }}
              >
                {tournamentList.length === 0 ? (
                  <option value="">
                    -- Chưa có Tournament --
                  </option>
                ) : (
                  tournamentList.map((tournament) => (
                    <option
                      key={tournament.tournamentId}
                      value={tournament.tournamentId}
                    >
                      {tournament.name}
                    </option>
                  ))
                )}
              </select>

              <FiChevronDown
                className={styles.selectIcon}
                size={14}
              />
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>
              Race hiện tại
            </label>

            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={selectedRaceId ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSelectedRaceId(value > 0 ? value : null);
                  setActionMsg('');
                  setActionError('');
                }}
              >
                {races.length === 0 ? (
                  <option value="">-- Chưa có race --</option>
                ) : (
                  races.map((race) => (
                    <option key={race.id} value={race.id}>
                      {race.label}
                    </option>
                  ))
                )}
              </select>

              <FiChevronDown
                className={styles.selectIcon}
                size={14}
              />
            </div>
          </div>
        </div>

        <div className={styles.actionRow}>
          {isDrawn ? (
            <Link
              to="/admin/assign-officials"
              className={styles.assignOfficialsBtn}
            >
              Assign Officials →
            </Link>
          ) : (
            <button
              type="button"
              className={styles.drawBtn}
              onClick={handleDraw}
              disabled={drawing || !selectedRaceId}
            >
              {drawing
                ? 'Đang bốc...'
                : 'Draw post positions'}
            </button>
          )}
        </div>

        {actionMsg && (
          <p className={styles.successMsg}>{actionMsg}</p>
        )}

        {actionError && (
          <p className={styles.errorMsg}>{actionError}</p>
        )}
      </div>

      <div className={styles.allocationGrid}>
        <div className={styles.tableCard}>
          <div className={styles.tableCardHeader}>
            <h3 className={styles.tableTitle}>
              Pairing chưa allocate
            </h3>

            <span className={styles.countBadge}>
              {unallocatedPairings.length}
            </span>
          </div>

          <p className={styles.tableSubtext}>
            {canAllocateToSelectedRace
              ? 'Chỉ pairing đủ điều kiện cho race đang chọn.'
              : 'Race đang chọn không còn nhận allocate pairing.'}
          </p>

          {!canAllocateToSelectedRace ? (
            <p className={styles.emptyCell}>
              Chọn race Upcoming chưa bốc thăm để allocate pairing.
            </p>
          ) : loadingPairings ? (
            <p className={styles.emptyCell}>Đang tải...</p>
          ) : unallocatedPairings.length === 0 ? (
            <p className={styles.emptyCell}>
              Chưa có pairing đủ điều kiện để allocate vào race này.
            </p>
          ) : (
            <div className={styles.pairingList}>
              {unallocatedPairings.map((pairing) => (
                <div
                  key={pairing.pairingId}
                  className={styles.pairingItem}
                >
                  <div>
                    <div className={styles.pairingHorse}>
                      {pairing.horseName}{' '}
                      <span className={styles.pairingBreed}>
                        {pairing.horseBreed}
                      </span>
                    </div>

                    <div className={styles.pairingMeta}>
                      Jockey {pairing.jockeyName} · Owner{' '}
                      {pairing.ownerName} · Pairing #
                      {pairing.pairingId}
                      {pairing.advancementStatus === 'AlsoEligible'
                        ? ' · Đồng hạng — đủ điều kiện'
                        : pairing.advancementStatus === 'Qualified'
                          ? ' · Đủ điều kiện'
                          : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.allocateBtn}
                    onClick={() =>
                      handleAllocate(pairing.pairingId)
                    }
                    disabled={
                      allocatingId === pairing.pairingId ||
                      !selectedRaceId ||
                      !canAllocateToSelectedRace
                    }
                  >
                    {allocatingId === pairing.pairingId
                      ? 'Đang xử lý...'
                      : 'Allocate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableCardHeader}>
            <h3 className={styles.tableTitle}>
              Pairing đã allocate vào race hiện tại
            </h3>

            <span className={styles.countBadge}>
              {entries.length}
            </span>
          </div>

          <p className={styles.tableSubtext}>
            {selectedRace?.label ?? '—'}
          </p>

          {loadingSchedule ? (
            <p className={styles.emptyCell}>Đang tải...</p>
          ) : entries.length === 0 ? (
            <p className={styles.emptyCell}>
              Chưa có pairing nào được allocate vào race này.
            </p>
          ) : (
            <div className={styles.pairingList}>
              {entries.map((entry) => (
                <div
                  key={entry.raceEntryId}
                  className={styles.pairingItem}
                >
                  <div>
                    <div className={styles.pairingHorse}>
                      {entry.horseName}
                    </div>

                    <div className={styles.pairingMeta}>
                      Jockey {entry.jockeyName} · Gate{' '}
                      {entry.postPosition ?? '—'}
                    </div>
                  </div>

                  <span
                    className={`${styles.badge} ${
                      entry.status === 'Confirmed'
                        ? styles.confirmed
                        : styles.pending
                    }`}
                  >
                    {entry.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.tableCard}>
        <h3 className={styles.tableTitle}>Starting list</h3>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Gate</th>
                <th>Horse</th>
                <th>Jockey</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Fee</th>
              </tr>
            </thead>

            <tbody>
              {loadingSchedule ? (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.emptyCell}
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.emptyCell}
                  >
                    Chưa có entry nào.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.raceEntryId}>
                    <td className={styles.gate}>
                      {entry.postPosition ?? '—'}
                    </td>

                    <td className={styles.name}>
                      {entry.horseName}
                    </td>

                    <td>{entry.jockeyName}</td>
                    <td>{entry.ownerName ?? '—'}</td>

                    <td>
                      <span
                        className={`${styles.badge} ${
                          entry.status === 'Confirmed'
                            ? styles.confirmed
                            : styles.pending
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>

                    <td>{entry.entryFeeStatus}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
const Modal = ({ title, children, onCancel, onConfirm, confirm, loading }: { title: string; children: React.ReactNode; onCancel: () => void; onConfirm: () => void; confirm: string; loading: boolean }) => <div className={styles.modalLayer}><div className={styles.modal}><h2>{title}</h2><p>{children}</p><div><button className={styles.secondary} onClick={onCancel}>Hủy</button><button className={styles.primary} disabled={loading} onClick={onConfirm}>{loading ? 'Đang xử lý…' : confirm}</button></div></div></div>;
export default RaceOperations;
