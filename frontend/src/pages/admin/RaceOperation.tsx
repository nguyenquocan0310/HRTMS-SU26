import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowRight, FiCheck, FiFlag, FiMapPin, FiMove, FiRefreshCw, FiShuffle } from 'react-icons/fi';
import { getTournaments, type RoundResponse, type TournamentResponse } from '../../services/tournamentService';
import { autoAllocate, finalizeRound, getRaceSchedule, getRoundWaitlist, moveRaceEntry, type RaceSchedule, type ScheduledEntry, type WaitlistEntry } from '../../services/schedulingService';
import { adminError, adminLabel, dateTime } from '../../utils/adminLabels';
import styles from './RaceOperation.module.scss';

const RaceOperations = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [schedules, setSchedules] = useState<RaceSchedule[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRound, setLoadingRound] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [allocateConfirm, setAllocateConfirm] = useState(false);
  const [finalizeConfirm, setFinalizeConfirm] = useState(false);
  const [move, setMove] = useState<{ entry: ScheduledEntry; sourceRaceId: number; targetRaceId: number } | null>(null);

  const selectedTournamentId = Number(search.get('tournamentId')) || null;
  const selectedRoundId = Number(search.get('roundId')) || null;
  const tournament = useMemo(
    () => tournaments.find((item) => item.tournamentId === selectedTournamentId) ?? null,
    [tournaments, selectedTournamentId],
  );
  const round = useMemo<RoundResponse | null>(
    () => tournament?.rounds.find((item) => item.roundId === selectedRoundId) ?? null,
    [tournament, selectedRoundId],
  );

  const setSelection = (tournamentId?: number, roundId?: number) => {
    const next = new URLSearchParams();
    if (tournamentId) next.set('tournamentId', String(tournamentId));
    if (roundId) next.set('roundId', String(roundId));
    setSearch(next, { replace: true });
  };

  useEffect(() => {
    void getTournaments()
      .then((data) => {
        setTournaments(data);
        const initialTournament = data.find((item) => item.tournamentId === selectedTournamentId) ?? data[0];
        const initialRound = initialTournament?.rounds.find((item) => item.roundId === selectedRoundId) ?? initialTournament?.rounds[0];

        if (initialTournament && initialRound && (
          initialTournament.tournamentId !== selectedTournamentId || initialRound.roundId !== selectedRoundId
        )) {
          setSelection(initialTournament.tournamentId, initialRound.roundId);
        }
      })
      .catch((err) => setError(adminError(err, 'Không tải được danh sách giải đấu.')))
      .finally(() => setLoading(false));
  }, []);

  const refreshRound = async () => {
    if (!round) {
      setSchedules([]);
      setWaitlist([]);
      return;
    }

    setLoadingRound(true);
    setError('');
    try {
      const [races, waiting] = await Promise.all([
        Promise.all(round.races.map((race) => getRaceSchedule(race.raceId))),
        getRoundWaitlist(round.roundId),
      ]);
      setSchedules(races.sort((a, b) => a.raceNumber - b.raceNumber));
      setWaitlist(waiting);
    } catch (err) {
      setError(adminError(err, 'Không tải được thông tin vòng đấu.'));
    } finally {
      setLoadingRound(false);
    }
  };

  useEffect(() => {
    void refreshRound();
  }, [round?.roundId]);

  const allocate = async () => {
    if (!round) return;

    setWorking(true);
    setAllocateConfirm(false);
    setError('');
    try {
      const result = await autoAllocate(round.roundId);
      setNotice(`Đã phân ${result.allocatedCount}/${result.poolSize} cặp vào cuộc đua. ${result.waitlistedCount} cặp đang chờ.`);
      await refreshRound();
    } catch (err) {
      setError(adminError(err));
    } finally {
      setWorking(false);
    }
  };

  const finalize = async () => {
    if (!round) return;

    setWorking(true);
    setFinalizeConfirm(false);
    setError('');
    try {
      const result = await finalizeRound(round.roundId);
      setNotice(`Đã hoàn tất điều hành vòng đấu: phân ${result.allocation.allocatedCount} cặp và bốc thăm ${result.draws.length} cuộc đua.`);
      await refreshRound();
    } catch (err) {
      setError(adminError(err));
    } finally {
      setWorking(false);
    }
  };

  const submitMove = async () => {
    if (!move || move.sourceRaceId === move.targetRaceId) return;

    setWorking(true);
    setError('');
    try {
      await moveRaceEntry(move.entry.raceEntryId, move.targetRaceId);
      setMove(null);
      setNotice(`Đã chuyển ${move.entry.horseName} sang cuộc đua đích.`);
      await refreshRound();
    } catch (err) {
      setError(adminError(err));
    } finally {
      setWorking(false);
    }
  };

  const capacity = tournament?.raceCapacity ?? schedules[0]?.raceCapacity ?? null;
  const hasAllocation = schedules.some((race) => race.entries.length > 0);
  const allDrawn = schedules.length > 0 && schedules.every((race) => race.isPostPositionDrawn);
  const canAllocate = Boolean(round) && !hasAllocation && !allDrawn;
  const drawHref = `/admin/post-position-draw?${search.toString()}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Điều hành vòng đấu</h1>
          <p>Chọn giải và vòng để theo dõi lệ phí, phân cuộc đua, bốc thăm và phân công cán bộ trong cùng một luồng.</p>
        </div>
        <button className={styles.refresh} onClick={() => void refreshRound()} disabled={loadingRound || !round}>
          <FiRefreshCw /> Làm mới
        </button>
      </header>

      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}

      <section className={styles.card}>
        <div className={styles.selectors}>
          <label>
            Giải đấu
            <select
              value={selectedTournamentId ?? ''}
              onChange={(event) => {
                const id = Number(event.target.value);
                const nextTournament = tournaments.find((item) => item.tournamentId === id);
                setSelection(id, nextTournament?.rounds[0]?.roundId);
              }}
            >
              <option value="">-- Chọn giải đấu --</option>
              {tournaments.map((item) => <option key={item.tournamentId} value={item.tournamentId}>{item.name}</option>)}
            </select>
          </label>

          <label>
            Vòng đấu
            <select
              value={selectedRoundId ?? ''}
              disabled={!tournament}
              onChange={(event) => setSelection(selectedTournamentId ?? undefined, Number(event.target.value))}
            >
              <option value="">-- Chọn vòng đấu --</option>
              {tournament?.rounds.map((item) => (
                <option key={item.roundId} value={item.roundId}>
                  {item.name} · {item.races.length} cuộc đua · {adminLabel(item.status)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tournament && (
          <div className={styles.venue}>
            <span className={styles.venueName}><FiMapPin /> {tournament.venueName ?? 'Chưa gán trường đua'}{tournament.venueCity ? ` · ${tournament.venueCity}` : ''}</span>
            <span>Mặt sân: <strong>{adminLabel(tournament.trackType)}</strong></span>
            <span>Số làn: <strong>{tournament.laneCount ?? '—'}</strong></span>
            <span>Chiều dài: <strong>{tournament.trackLengthMeters ? `${tournament.trackLengthMeters.toLocaleString('vi-VN')}m` : '—'}</strong></span>
            <span>Sức chứa mỗi cuộc đua: <strong>{capacity ?? '—'}</strong></span>
          </div>
        )}

        <div className={styles.progress} aria-label="Tiến độ điều hành vòng đấu">
          <span className={styles.done}><FiCheck /> 1. Lệ phí đã sẵn sàng</span>
          <span className={hasAllocation ? styles.done : styles.current}><FiCheck /> 2. Phân vào cuộc đua {hasAllocation ? 'đã chốt' : 'chưa chốt'}</span>
          <span className={allDrawn ? styles.done : styles.pending}>3. Bốc thăm {allDrawn ? 'đã hoàn tất' : 'chưa thực hiện'}</span>
          <span className={schedules.some((race) => race.status === 'Official') ? styles.done : styles.pending}>4. Trọng tài kiểm tra từng cuộc đua</span>
        </div>

        <div className={styles.actions}>
          <button className={styles.primary} disabled={working || !canAllocate} onClick={() => setAllocateConfirm(true)}>
            <FiFlag /> Phân race
          </button>
          <button className={styles.secondary} disabled={!round} onClick={() => navigate(drawHref)}>
            <FiShuffle /> Bốc thăm vị trí xuất phát
          </button>
          <button className={styles.secondary} disabled={working || !round} onClick={() => setFinalizeConfirm(true)}>
            Hoàn tất phân race và bốc thăm (dùng cho demo)
          </button>
        </div>
      </section>

      {loading || loadingRound ? (
        <section className={styles.card}><p className={styles.empty}>Đang tải dữ liệu vòng đấu…</p></section>
      ) : !round ? (
        <section className={styles.card}><p className={styles.empty}>Chọn giải đấu và vòng đấu để bắt đầu điều hành.</p></section>
      ) : (
        <>
          <section className={styles.card}>
            <h2>Xem trước khi chốt</h2>
            {hasAllocation ? (
              <p className={styles.previewText}>Danh sách đã được chốt. Bạn có thể điều chỉnh ngựa giữa các cuộc đua trước khi bốc thăm.</p>
            ) : (
              <p className={styles.empty}>Chưa có cặp đấu nào đủ điều kiện (đã xác nhận lệ phí) để phân vào cuộc đua.</p>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionTitle}>
              <div>
                <h2>Danh sách chờ <span>{waitlist.length}</span></h2>
                <p>Cặp đấu đủ điều kiện nhưng vượt sức chứa của vòng. Thứ tự là thứ tự gọi bù.</p>
              </div>
            </div>
            {waitlist.length === 0 ? (
              <p className={styles.empty}>Không có cặp đấu nào phải chờ.</p>
            ) : (
              <ol className={styles.waitlist}>
                {waitlist.map((entry) => (
                  <li key={entry.pairingId}>
                    <b>{entry.position}</b>
                    <span><strong>{entry.horseName}</strong><small>Cặp đấu #{entry.pairingId} · Đã xác nhận lệ phí: {dateTime(entry.feeVerifiedAt)}</small></span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={styles.raceList}>
            {schedules.map((race) => (
              <article className={styles.raceCard} key={race.raceId}>
                <header>
                  <div>
                    <h2>Cuộc đua #{race.raceNumber} · {dateTime(race.scheduledTime)}</h2>
                    <p>{race.isPostPositionDrawn ? 'Đã bốc thăm vị trí xuất phát.' : 'Chưa bốc thăm — vị trí xuất phát để trống.'}</p>
                  </div>
                  <span>{race.entries.length}/{race.raceCapacity ?? capacity ?? '—'}</span>
                </header>

                {race.entries.length === 0 ? (
                  <p className={styles.empty}>Chưa có ngựa nào trong cuộc đua này.</p>
                ) : (
                  <ul>
                    {race.entries
                      .slice()
                      .sort((a, b) => (a.postPosition ?? Number.MAX_SAFE_INTEGER) - (b.postPosition ?? Number.MAX_SAFE_INTEGER))
                      .map((entry) => (
                        <li key={entry.raceEntryId}>
                          <span className={styles.position}>{entry.postPosition ?? '—'}</span>
                          <span><strong>{entry.horseName}</strong><small>Nài: {entry.jockeyName} · {adminLabel(entry.status)}</small></span>
                          {!race.isPostPositionDrawn && (
                            <button onClick={() => setMove({ entry, sourceRaceId: race.raceId, targetRaceId: 0 })}>
                              <FiMove /> Chuyển
                            </button>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </article>
            ))}
          </section>
        </>
      )}

      {allocateConfirm && (
        <Modal
          title="Phân race cho cả vòng đấu"
          onCancel={() => setAllocateConfirm(false)}
          onConfirm={() => void allocate()}
          confirm="Phân race"
          loading={working}
        >
          Hệ thống sẽ chốt danh sách cặp đã xác nhận lệ phí, tự động phân toàn bộ vào các cuộc đua của vòng và lập danh sách chờ nếu vượt sức chứa.
        </Modal>
      )}

      {finalizeConfirm && (
        <Modal
          title="Hoàn tất phân race và bốc thăm"
          onCancel={() => setFinalizeConfirm(false)}
          onConfirm={() => void finalize()}
          confirm="Hoàn tất"
          loading={working}
        >
          Hệ thống sẽ phân các cặp đủ điều kiện và bốc thăm độc lập từng cuộc đua. Cuộc đua không đủ điều kiện sẽ được giữ nguyên để xử lý sau.
        </Modal>
      )}

      {move && (
        <div className={styles.modalLayer}>
          <div className={styles.modal}>
            <h2>Chuyển ngựa sang cuộc đua khác</h2>
            <p>Chỉ có thể chuyển trong cùng vòng và trước khi bốc thăm.</p>
            <label>
              Cuộc đua đích
              <select value={move.targetRaceId} onChange={(event) => setMove({ ...move, targetRaceId: Number(event.target.value) })}>
                <option value="0">-- Chọn cuộc đua --</option>
                {schedules.filter((race) => race.raceId !== move.sourceRaceId).map((race) => (
                  <option key={race.raceId} value={race.raceId}>
                    Cuộc đua #{race.raceNumber} · {race.entries.length}/{race.raceCapacity ?? capacity ?? '—'}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button className={styles.secondary} onClick={() => setMove(null)}>Hủy</button>
              <button className={styles.primary} disabled={working || !move.targetRaceId} onClick={() => void submitMove()}>
                <FiArrowRight /> Chuyển cuộc đua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Modal = ({
  title,
  children,
  onCancel,
  onConfirm,
  confirm,
  loading,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirm: string;
  loading: boolean;
}) => (
  <div className={styles.modalLayer}>
    <div className={styles.modal}>
      <h2>{title}</h2>
      <p>{children}</p>
      <div>
        <button className={styles.secondary} onClick={onCancel}>Hủy</button>
        <button className={styles.primary} disabled={loading} onClick={onConfirm}>{loading ? 'Đang xử lý…' : confirm}</button>
      </div>
    </div>
  </div>
);

export default RaceOperations;
