import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiChevronDown, FiEye, FiMapPin } from 'react-icons/fi';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import { getRaceSchedule } from '../../services/schedulingService';
import { adminError, dateTime } from '../../utils/adminLabels';

type RaceRow = UnofficialRace & { entryCount: number; venueName?: string | null; venueCity?: string | null };
const RaceList = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]); const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [races, setRaces] = useState<RaceRow[]>([]); const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null); const [detail, setDetail] = useState<RaceRow | null>(null);
  const [loading, setLoading] = useState(true); const [declaring, setDeclaring] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const tournament = useMemo<TournamentResponse | null>(() => tournaments.find((item) => item.tournamentId === tournamentId) ?? null, [tournaments, tournamentId]);
  useEffect(() => { void getTournaments().then((items) => { setTournaments(items); setTournamentId(items[0]?.tournamentId ?? null); }).catch((err) => setError(adminError(err))).finally(() => setLoading(false)); }, []);
  const loadRaces = async (id: number) => { setLoading(true); setError(''); try { const list = await getUnofficialRaces(id); const schedules = await Promise.all(list.map(async (race) => { try { return await getRaceSchedule(race.raceId); } catch { return null; } })); const rows = list.map((race, index) => ({ ...race, entryCount: schedules[index]?.entries.length ?? 0, venueName: schedules[index]?.venueName, venueCity: schedules[index]?.venueCity })); setRaces(rows); setSelectedRaceId((current) => rows.some((race) => race.raceId === current) ? current : rows[0]?.raceId ?? null); } catch (err) { setError(adminError(err, 'Không tải được danh sách cuộc đua.')); setRaces([]); } finally { setLoading(false); } };
  useEffect(() => { if (tournamentId) void loadRaces(tournamentId); else setRaces([]); }, [tournamentId]);
  const selected = races.find((item) => item.raceId === selectedRaceId) ?? null;
  const declareOfficial = async (race: RaceRow) => { if (!window.confirm(`Chuyển cuộc đua #${race.raceNumber} sang trạng thái chính thức?`)) return; setDeclaring(true); setError(''); try { await declareRaceOfficial(race.raceId, { confirmedByAdmin: true }); setNotice(`Cuộc đua #${race.raceNumber} đã chuyển sang trạng thái chính thức.`); setDetail(null); if (tournamentId) await loadRaces(tournamentId); } catch (err) { setError(adminError(err, 'Không thể chuyển trạng thái cuộc đua.')); } finally { setDeclaring(false); } };
  return <div className={styles.page}><header><h1>Danh sách cuộc đua</h1></header>{notice && <div className={styles.notice}>{notice}</div>}{error && <div className={styles.error}>{error}</div>}
    <section className={styles.card}><div className={styles.filters}><label>Giải đấu<div><select value={tournamentId ?? ''} onChange={(event) => { setTournamentId(event.target.value ? Number(event.target.value) : null); setDetail(null); }}><option value="">-- Chọn giải đấu --</option>{tournaments.map((item) => <option key={item.tournamentId} value={item.tournamentId}>{item.name}</option>)}</select><FiChevronDown /></div></label><label>Cuộc đua hiện tại<div><select value={selectedRaceId ?? ''} onChange={(event) => setSelectedRaceId(event.target.value ? Number(event.target.value) : null)} disabled={races.length === 0}><option value="">-- Không có cuộc đua chưa chính thức --</option>{races.map((race) => <option key={race.raceId} value={race.raceId}>{race.roundName} · Cuộc đua #{race.raceNumber}</option>)}</select><FiChevronDown /></div></label></div>{selected && <div className={styles.selected}><strong>{selected.roundName} · Cuộc đua #{selected.raceNumber}</strong><span>{dateTime(selected.scheduledTime)}</span><span>{selected.entryCount} ngựa đăng ký</span>{tournament?.venueName && <span><FiMapPin /> {tournament.venueName}{tournament.venueCity ? ` · ${tournament.venueCity}` : ''}</span>}<button onClick={() => setDetail(selected)}><FiEye /> Xem chi tiết</button></div>}</section>
    <section className={styles.card}><div className={styles.titleRow}><h2>Cuộc đua chưa chính thức</h2><span>{races.length}</span></div>{loading ? <p className={styles.empty}>Đang tải danh sách cuộc đua…</p> : races.length === 0 ? <p className={styles.empty}>Không có cuộc đua chưa chính thức trong giải đấu này.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Cuộc đua</th><th>Vòng đấu</th><th>Thời gian</th><th>Địa điểm</th><th>Số ngựa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{races.map((race) => <tr key={race.raceId}><td><strong>Cuộc đua #{race.raceNumber}</strong></td><td>{race.roundName}</td><td>{dateTime(race.scheduledTime)}</td><td>{race.venueName ?? tournament?.venueName ?? '—'}{(race.venueCity ?? tournament?.venueCity) && <small>{race.venueCity ?? tournament?.venueCity}</small>}</td><td>{race.entryCount}</td><td><span className={styles.status}>Chưa chính thức</span></td><td><button className={styles.view} onClick={() => setDetail(race)}><FiEye /> Xem</button></td></tr>)}</tbody></table></div>}</section>
    {detail && <div className={styles.modalLayer}><div className={styles.modal}><h2>Cuộc đua #{detail.raceNumber}</h2><dl><dt>Vòng đấu</dt><dd>{detail.roundName}</dd><dt>Thời gian</dt><dd>{dateTime(detail.scheduledTime)}</dd><dt>Số ngựa</dt><dd>{detail.entryCount}</dd><dt>Trạng thái</dt><dd>Chưa chính thức</dd></dl><p className={styles.muted}>Chỉ chuyển trạng thái sau khi kết quả, chi thưởng và các điều kiện nghiệp vụ đã sẵn sàng.</p><div><button onClick={() => setDetail(null)}>Đóng</button><button className={styles.official} disabled={!detail.canDeclareOfficial || declaring} onClick={() => void declareOfficial(detail)}><FiCheckCircle /> {declaring ? 'Đang xử lý…' : 'Chuyển chính thức'}</button></div>{!detail.canDeclareOfficial && <small className={styles.hint}>Cuộc đua chưa đáp ứng đủ điều kiện để chuyển sang chính thức.</small>}</div></div>}
  </div>;
};
import {
  getUnofficialRaces, getLiveRaceStatus, declareRaceOfficial,
  type UnofficialRace, type LiveRaceStatus, type LiveRaceEntry,
} from '../../services/raceOperationService';
import { getProtestsByRace } from '../../services/protestService';
import { getUserBasicInfo } from '../../services/approvalService';
import styles from './RaceList.module.scss';

type ProtestItem = Awaited<ReturnType<typeof getProtestsByRace>>[number];
type RaceListItem = Pick<UnofficialRace,
  'raceId' | 'tournamentId' | 'tournamentName' | 'roundName' | 'raceNumber' | 'scheduledTime'
> & { displayStatus: 'Unofficial' | 'Official' };

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00 ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

// Quy ước tên người Việt: từ cuối cùng là tên gọi (vd "Nguyễn Văn Hoàng" -> "Hoàng").
const givenName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
};

const readProtestValue = (protest: ProtestItem, keys: string[]): string => {
  const record = protest as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return String(value);
  }
  return '—';
};

const getOfficialRaces = (tournament: TournamentResponse | undefined): RaceListItem[] =>
  tournament?.rounds.flatMap((round) =>
    round.races
      .filter((race) => race.status === 'Official')
      .map((race) => ({
        raceId: race.raceId,
        tournamentId: tournament.tournamentId,
        tournamentName: tournament.name,
        roundName: round.name,
        raceNumber: race.raceNumber,
        scheduledTime: race.scheduledTime,
        displayStatus: 'Official',
      }))
  ) ?? [];

const RaceList = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);

  const [races, setRaces] = useState<RaceListItem[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [loadingRaces, setLoadingRaces] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [liveStatus, setLiveStatus] = useState<LiveRaceStatus | null>(null);
  const [protests, setProtests] = useState<ProtestItem[]>([]);

  const [declaring, setDeclaring] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [protestSubmitterNames, setProtestSubmitterNames] = useState<Record<number, string>>({});



  useEffect(() => {
    getTournaments()
      .then((list) => {
        setTournaments(list);
        if (list.length > 0) setSelectedTournamentId(list[0].tournamentId);
      })
      .catch(() => setTournaments([]));
  }, []);

  const reloadRaces = (tournamentId: number) => {
    setLoadingRaces(true);
    getUnofficialRaces(tournamentId)
      .then((unofficialRaces) => {
        const raceById = new Map<number, RaceListItem>();
        unofficialRaces.forEach((race) => raceById.set(race.raceId, {
          raceId: race.raceId,
          tournamentId: race.tournamentId,
          tournamentName: race.tournamentName,
          roundName: race.roundName,
          raceNumber: race.raceNumber,
          scheduledTime: race.scheduledTime,
          displayStatus: 'Unofficial',
        }));
        getOfficialRaces(tournaments.find((t) => t.tournamentId === tournamentId))
          .forEach((race) => raceById.set(race.raceId, race));
        const list = Array.from(raceById.values());
        setRaces(list);
        setSelectedRaceId((current) =>
          current && list.some((r) => r.raceId === current) ? current : (list[0]?.raceId ?? null)
        );
      })
      .catch(() => { setRaces([]); setSelectedRaceId(null); })
      .finally(() => setLoadingRaces(false));
  };

  useEffect(() => {
    if (!selectedTournamentId) { setRaces([]); setSelectedRaceId(null); return; }
    reloadRaces(selectedTournamentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournamentId]);

  const selectedRace = races.find((r) => r.raceId === selectedRaceId) ?? null;
  const selectedRaceIsOfficial = selectedRace?.displayStatus === 'Official';

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailError('');
    setLiveStatus(null);
    setProtests([]);
    setProtestSubmitterNames({});
  };

  const handleViewDetail = async () => {
    if (!selectedRace) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    try {
      const [status, protestList] = await Promise.all([
        getLiveRaceStatus(selectedRace.raceId),
        getProtestsByRace(selectedRace.raceId),
      ]);
      setLiveStatus(status);
      setProtests(protestList);

      // Tra cứu tên người gửi cho từng userId khác nhau xuất hiện trong danh sách protest.
      const uniqueUserIds = Array.from(
        new Set(protestList.map((p) => (p as unknown as { submittedByUserId: number }).submittedByUserId))
      ).filter((id) => typeof id === 'number' && !Number.isNaN(id));

      const nameEntries = await Promise.all(
        uniqueUserIds.map(async (userId) => {
          const info = await getUserBasicInfo(userId);
          return [userId, info?.fullName ?? `User #${userId}`] as const;
        })
      );

      setProtestSubmitterNames(Object.fromEntries(nameEntries));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Không tải được kết quả sơ bộ.');
    } finally {
      setDetailLoading(false);
    }
  };

const handleDeclareOfficial = async () => {
    if (!selectedRace) return;
    const confirmed = window.confirm('Bạn có chắc muốn chuyển Race này sang trạng thái Official không?');
    if (!confirmed) return;

    setDeclaring(true);
    setActionMsg(''); setActionError('');
    try {
      await declareRaceOfficial(selectedRace.raceId, { confirmedByAdmin: true });
      setActionMsg('Race đã được chuyển sang trạng thái Official.');
      setRaces((prev) => prev.map((race) =>
        race.raceId === selectedRace.raceId ? { ...race, displayStatus: 'Official' } : race
      ));
      setTournaments((prev) => prev.map((tournament) =>
        tournament.tournamentId !== selectedRace.tournamentId ? tournament : {
          ...tournament,
          rounds: tournament.rounds.map((round) => ({
            ...round,
            races: round.races.map((race) =>
              race.raceId === selectedRace.raceId ? { ...race, status: 'Official' } : race
            ),
          })),
        }
      ));
      // Không gọi reloadRaces ở đây — race vừa Official sẽ bị GET /races/unofficial
      // lọc mất; giữ nguyên danh sách hiện tại để vẫn thấy được, chỉ cập nhật badge.
      setLiveStatus((prev) => (prev ? { ...prev, status: 'Official' } : prev));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Không thể chuyển Race thành Official.');
    } finally {
      setDeclaring(false);
    }
  };

  // Nhóm entries: xếp hạng hợp lệ (có finishPosition, không bị loại) và nhóm bị loại riêng
  const rankedEntries: LiveRaceEntry[] = (liveStatus?.entries ?? [])
    .filter((e) => e.finishPosition !== null && e.status !== 'Disqualified' && e.status !== 'Cancelled')
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));

  const eliminatedEntries: LiveRaceEntry[] = (liveStatus?.entries ?? [])
    .filter((e) => e.status === 'Disqualified' || e.status === 'Cancelled' || e.isWithdrawn);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Race List</h2>
        <p className={styles.sectionDesc}>Danh sách các race Unofficial của tournament được chọn.</p>
      </div>

      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Tournament</label>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={selectedTournamentId ?? ''}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setSelectedTournamentId(value > 0 ? value : null);
                  setActionMsg(''); setActionError('');
                  closeDetail();
                }}
              >
                {tournaments.length === 0 ? (
                  <option value="">-- Chưa có Tournament --</option>
                ) : (
                  tournaments.map((t) => (
                    <option key={t.tournamentId} value={t.tournamentId}>{t.name}</option>
                  ))
                )}
              </select>
              <FiChevronDown className={styles.selectIcon} size={14} />
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Race hiện tại</label>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={selectedRaceId ?? ''}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setSelectedRaceId(value > 0 ? value : null);
                  setActionMsg(''); setActionError('');
                  closeDetail();
                }}
              >
                {races.length === 0 ? (
                  <option value="">-- Không có race Unofficial --</option>
                ) : (
                  races.map((r) => (
                    <option key={r.raceId} value={r.raceId}>
                      {r.roundName} - Race #{r.raceNumber} · {formatDateTime(r.scheduledTime)}
                    </option>
                  ))
                )}
              </select>
              <FiChevronDown className={styles.selectIcon} size={14} />
            </div>
          </div>
        </div>

        {actionMsg && <p className={styles.successMsg}>{actionMsg}</p>}
        {actionError && <p className={styles.errorMsg}>{actionError}</p>}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <h3 className={styles.tableTitle}>Race List</h3>
          <span className={styles.countBadge}>{selectedRace ? 1 : 0}</span>
        </div>

        {loadingRaces ? (
          <p className={styles.emptyCell}>Đang tải...</p>
        ) : !selectedRace ? (
          <p className={styles.emptyCell}>Không có race Unofficial trong tournament này.</p>
        ) : (
          <div className={styles.pairingList}>
            <div className={styles.pairingItem}>
              <div>
                <div className={styles.pairingHorse}>
                  {selectedRace.roundName} - Race #{selectedRace.raceNumber}
                </div>
                <div className={styles.pairingMeta}>
                  {formatDateTime(selectedRace.scheduledTime)}
                </div>
                <div style={{ marginTop: '0.45rem' }}>
                  <span className={`${styles.badge} ${selectedRaceIsOfficial ? styles.confirmed : styles.pending}`}>
                    {selectedRace.displayStatus}
                  </span>
                </div>
              </div>
              <button type="button" className={styles.detailBtn} onClick={handleViewDetail}>
                View Detail
              </button>
            </div>
          </div>
        )}
      </div>

      {detailOpen && selectedRace && (
        <>
          <div className={styles.detailOverlay} onClick={closeDetail} />
          <aside className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <h3 className={styles.detailTitle}>Kết quả sơ bộ</h3>
                <p className={styles.detailSubtitle}>
                  {selectedRace.roundName} - Race #{selectedRace.raceNumber}
                </p>
              </div>
              <button type="button" className={styles.detailCloseBtn} onClick={closeDetail} aria-label="Đóng">
                <FiX size={20} />
              </button>
            </div>

            <div className={styles.detailStatusRow}>
              <span>Trạng thái Race</span>
              <span className={`${styles.badge} ${selectedRaceIsOfficial ? styles.confirmed : styles.pending}`}>
                {liveStatus?.status ?? selectedRace.displayStatus}
              </span>
            </div>

            {detailLoading ? (
              <p className={styles.detailLoading}>Đang tải chi tiết...</p>
            ) : detailError ? (
              <div className={styles.detailError}>{detailError}</div>
            ) : (
              <>
                <section className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Kết quả sơ bộ</h4>

                  {rankedEntries.length === 0 && eliminatedEntries.length === 0 ? (
                    <p className={styles.detailEmptyBox}>Chưa có kết quả nào được ghi nhận.</p>
                  ) : (
                    <div className={styles.rankList}>
                      {rankedEntries.map((entry) => (
                        <div key={entry.raceEntryId} className={styles.rankItem}>
                          <span className={styles.rankLabel}>Hạng {entry.finishPosition}</span>
                          <span className={styles.rankPairing}>
                            {entry.horseName} - {givenName(entry.jockeyName)}
                          </span>
                          {entry.finishTime !== null && (
                            <span className={styles.rankMeta}>Thời gian: {entry.finishTime.toFixed(2)}s</span>
                          )}
                        </div>
                      ))}

                      {eliminatedEntries.map((entry) => (
                        <div key={entry.raceEntryId} className={styles.rankItem}>
                          <span className={styles.rankLabelEliminated}>Bị loại</span>
                          <span className={styles.rankPairing}>
                            {entry.horseName} - {givenName(entry.jockeyName)}
                          </span>
                          <span className={styles.rankMeta}>
                            ({entry.status === 'Disqualified' ? 'Truất quyền thi đấu' : 'Đã hủy đăng ký'})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Khiếu nại</h4>

                  {protests.length === 0 ? (
                    <p className={styles.detailEmptyBox}>Race này chưa có khiếu nại.</p>
                  ) : (
                    <div className={styles.protestList}>
                      {protests.map((protest, index) => (
                        <div
                          key={`${readProtestValue(protest, ['protestId', 'id'])}-${index}`}
                          className={styles.protestItem}
                        >
                          <div className={styles.protestTop}>
                            <strong>Khiếu nại #{readProtestValue(protest, ['protestId', 'id'])}</strong>
                            <span className={styles.protestStatus}>
                              {readProtestValue(protest, ['status', 'decision', 'rulingStatus'])}
                            </span>
                          </div>
                          <p>{readProtestValue(protest, ['description', 'reason', 'content', 'notes'])}</p>
                          <small>
                            Người gửi: {protestSubmitterNames[(protest as unknown as { submittedByUserId: number }).submittedByUserId] ?? '—'}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {!selectedRaceIsOfficial && (
                  <div className={styles.detailActions}>
                    <button
                      type="button"
                      className={styles.declareOfficialBtn}
                      onClick={handleDeclareOfficial}
                      disabled={declaring}
                    >
                      {declaring ? 'Đang xử lý...' : 'Official'}
                    </button>
                  </div>
                )}
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
};

export default RaceList;
