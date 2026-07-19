import { useEffect, useState } from 'react';
import { FiChevronDown, FiX } from 'react-icons/fi';
import { getTournaments, type TournamentResponse } from '../../services/tournamentService';
import {
  getUnofficialRaces, getLiveRaceStatus, declareRaceOfficial,
  type UnofficialRace, type LiveRaceStatus, type LiveRaceEntry,
} from '../../services/raceOperationService';
import { getProtestsByRace } from '../../services/protestService';
import styles from './RaceList.module.scss';

type ProtestItem = Awaited<ReturnType<typeof getProtestsByRace>>[number];

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

const RaceList = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);

  const [races, setRaces] = useState<UnofficialRace[]>([]);
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
  const [justOfficialIds, setJustOfficialIds] = useState<Set<number>>(new Set());


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
      .then((list) => {
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

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailError('');
    setLiveStatus(null);
    setProtests([]);
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
      setJustOfficialIds((prev) => new Set(prev).add(selectedRace.raceId));
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
                  <span className={`${styles.badge} ${justOfficialIds.has(selectedRace.raceId) ? styles.confirmed : styles.pending}`}>
                    {justOfficialIds.has(selectedRace.raceId) ? 'Official' : 'Unofficial'}
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
              <span className={`${styles.badge} ${styles.pending}`}>
                {liveStatus?.status ?? 'Unofficial'}
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
                            Người gửi: {readProtestValue(protest, ['submittedByName', 'protesterName', 'createdByName', 'userName'])}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {!justOfficialIds.has(selectedRace.raceId) && (
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