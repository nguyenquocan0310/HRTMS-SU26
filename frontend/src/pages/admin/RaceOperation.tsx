import { useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiX } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import {
  getTournaments,
  type TournamentResponse,
} from '../../services/tournamentService';

import {
  getRaceEntries,
  allocateEntry,
  drawPostPositions,
  getAdminPairings,
  declareRaceOfficial,
  getRacePayouts,
  type RaceScheduleEntry,
  type AdminPairing,
  type RacePayout,
} from '../../services/raceOperationService';

import {
  getProtestsByRace,
} from '../../services/protestService';

import styles from './RaceOperation.module.scss';

interface RaceOption {
  id: number;
  label: string;
  isDrawn: boolean;
  status: string;
  raceNumber: number;
  roundName: string;
  scheduledTime: string;
}

type ProtestItem = Awaited<
  ReturnType<typeof getProtestsByRace>
>[number];

const formatDateTime = (iso: string) => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}:00 ${date.getDate()}/${
    date.getMonth() + 1
  }/${date.getFullYear()}`;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const readProtestValue = (
  protest: ProtestItem,
  keys: string[]
): string => {
  const record = protest as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ''
    ) {
      return String(value);
    }
  }

  return '—';
};

const RaceOperations = () => {
  const [tournamentList, setTournamentList] = useState<
    TournamentResponse[]
  >([]);

  const [selectedTournamentId, setSelectedTournamentId] =
    useState<number | null>(null);

  const [races, setRaces] = useState<RaceOption[]>([]);
  const [selectedRaceId, setSelectedRaceId] =
    useState<number | null>(null);

  const [entries, setEntries] = useState<RaceScheduleEntry[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const [unallocatedPairings, setUnallocatedPairings] = useState<
    AdminPairing[]
  >([]);

  const [loadingPairings, setLoadingPairings] = useState(false);
  const [allocatingId, setAllocatingId] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);

  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [declaringRaceId, setDeclaringRaceId] =
    useState<number | null>(null);

  // View Detail
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailPayouts, setDetailPayouts] = useState<RacePayout[]>([]);
  const [detailProtests, setDetailProtests] = useState<ProtestItem[]>([]);

  useEffect(() => {
    getTournaments()
      .then((list) => {
        setTournamentList(list);

        if (list.length > 0) {
          setSelectedTournamentId(list[0].tournamentId);
        }
      })
      .catch(() => setTournamentList([]));
  }, []);

  useEffect(() => {
    if (!selectedTournamentId || tournamentList.length === 0) {
      setRaces([]);
      setSelectedRaceId(null);
      return;
    }

    const tournament = tournamentList.find(
      (item) => item.tournamentId === selectedTournamentId
    );

    if (!tournament) {
      setRaces([]);
      setSelectedRaceId(null);
      return;
    }

    const options: RaceOption[] = tournament.rounds.flatMap((round) =>
      round.races.map((race) => ({
        id: race.raceId,
        label: `${round.name} · Race #${race.raceNumber} · ${formatDateTime(
          race.scheduledTime
        )}`,
        isDrawn: race.isPostPositionDrawn,
        status: race.status,
        raceNumber: race.raceNumber,
        roundName: round.name,
        scheduledTime: race.scheduledTime,
      }))
    );

    setRaces(options);

    setSelectedRaceId((currentRaceId) => {
      if (
        currentRaceId &&
        options.some((race) => race.id === currentRaceId)
      ) {
        return currentRaceId;
      }

      return options.length > 0 ? options[0].id : null;
    });
  }, [selectedTournamentId, tournamentList]);

  const reloadEntries = (raceId: number) => {
    setLoadingSchedule(true);

    getRaceEntries(raceId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoadingSchedule(false));
  };

  useEffect(() => {
    if (!selectedRaceId) {
      setEntries([]);
      return;
    }

    reloadEntries(selectedRaceId);
  }, [selectedRaceId]);

  const reloadUnallocatedPairings = () => {
    if (!selectedTournamentId || !selectedRaceId) {
      setUnallocatedPairings([]);
      return;
    }

    setLoadingPairings(true);

    getAdminPairings(selectedTournamentId, selectedRaceId, true)
      .then(setUnallocatedPairings)
      .catch(() => setUnallocatedPairings([]))
      .finally(() => setLoadingPairings(false));
  };

  useEffect(() => {
    reloadUnallocatedPairings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournamentId, selectedRaceId]);

  const reloadTournamentList = async () => {
    try {
      const list = await getTournaments();
      setTournamentList(list);
    } catch {
      // Giữ dữ liệu cũ nếu reload thất bại.
    }
  };

  const handleAllocate = async (pairingId: number) => {
    if (!selectedRaceId) {
      return;
    }

    setAllocatingId(pairingId);
    setActionMsg('');
    setActionError('');

    try {
      await allocateEntry(selectedRaceId, pairingId);
      setActionMsg('Allocate thành công!');
      reloadEntries(selectedRaceId);
      reloadUnallocatedPairings();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Allocate thất bại.'
      );
    } finally {
      setAllocatingId(null);
    }
  };

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

  const selectedRaceIsUnofficial =
    selectedRaceStatus === 'unofficial';

  const selectedRaceIsOfficial =
    selectedRaceStatus === 'official';

  const canAllocateToSelectedRace =
    selectedRaceStatus === 'upcoming' && !isDrawn;

  const handleDeclareOfficial = async (raceId: number) => {
    const confirmed = window.confirm(
      'Bạn có chắc muốn chuyển Race này sang trạng thái Official không?'
    );

    if (!confirmed) {
      return;
    }

    setDeclaringRaceId(raceId);
    setActionMsg('');
    setActionError('');

    try {
      await declareRaceOfficial(raceId, {
        confirmedByAdmin: true,
      });

      setActionMsg(
        'Race đã được chuyển sang trạng thái Official.'
      );

      await reloadTournamentList();

      if (detailOpen && selectedRaceId === raceId) {
        const payouts = await getRacePayouts(raceId);
        setDetailPayouts(payouts);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Không thể chuyển Race thành Official.'
      );
    } finally {
      setDeclaringRaceId(null);
    }
  };

  const handleViewRaceDetail = async () => {
    if (!selectedRace) {
      return;
    }

    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetailPayouts([]);
    setDetailProtests([]);

    try {
      const [payouts, protests] = await Promise.all([
        getRacePayouts(selectedRace.id),
        getProtestsByRace(selectedRace.id),
      ]);

      setDetailPayouts(payouts);
      setDetailProtests(protests);
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : 'Không tải được chi tiết Race.'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailError('');
    setDetailPayouts([]);
    setDetailProtests([]);
  };

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
                  closeDetail();
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
                  closeDetail();
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

      <div className={styles.tableCard}>
        <div className={styles.tableCardHeader}>
          <h3 className={styles.tableTitle}>Race List</h3>
          <span className={styles.countBadge}>
            {selectedRace ? 1 : 0}
          </span>
        </div>

        {!selectedRace ? (
          <p className={styles.emptyCell}>
            Vui lòng chọn một Race.
          </p>
        ) : (
          <div className={styles.pairingList}>
            <div className={styles.pairingItem}>
              <div>
                <div className={styles.pairingHorse}>
                  Race #{selectedRace.raceNumber}
                </div>

                <div className={styles.pairingMeta}>
                  {selectedRace.roundName || '—'} ·{' '}
                  {formatDateTime(selectedRace.scheduledTime)}
                </div>

                <div style={{ marginTop: '0.45rem' }}>
                  <span
                    className={`${styles.badge} ${
                      selectedRaceIsOfficial
                        ? styles.confirmed
                        : selectedRaceIsUnofficial
                          ? styles.pending
                          : styles.upcoming
                    }`}
                  >
                    {selectedRace.status || 'Unknown'}
                  </span>
                </div>
              </div>

              <div className={styles.raceActions}>
                <button
                  type="button"
                  className={styles.detailBtn}
                  onClick={handleViewRaceDetail}
                >
                  View Detail
                </button>

                {selectedRaceIsUnofficial && (
                  <button
                    type="button"
                    className={styles.allocateBtn}
                    onClick={() =>
                      handleDeclareOfficial(selectedRace.id)
                    }
                    disabled={
                      declaringRaceId === selectedRace.id
                    }
                  >
                    {declaringRaceId === selectedRace.id
                      ? 'Đang xử lý...'
                      : 'Official'}
                  </button>
                )}
              </div>
            </div>
          </div>
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

      {detailOpen && selectedRace && (
        <>
          <div
            className={styles.detailOverlay}
            onClick={closeDetail}
          />

          <aside className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              <div>
                <h3 className={styles.detailTitle}>
                  Kết quả sơ bộ
                </h3>

                <p className={styles.detailSubtitle}>
                  {selectedRace.roundName} · Race #
                  {selectedRace.raceNumber}
                </p>
              </div>

              <button
                type="button"
                className={styles.detailCloseBtn}
                onClick={closeDetail}
                aria-label="Đóng"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className={styles.detailStatusRow}>
              <span>Trạng thái Race</span>

              <span
                className={`${styles.badge} ${
                  selectedRaceIsOfficial
                    ? styles.confirmed
                    : styles.pending
                }`}
              >
                {selectedRace.status}
              </span>
            </div>

            {detailLoading ? (
              <p className={styles.detailLoading}>
                Đang tải chi tiết...
              </p>
            ) : detailError ? (
              <div className={styles.detailError}>
                {detailError}
              </div>
            ) : (
              <>
                <section className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>
                    Kết quả và chi thưởng
                  </h4>

                  <div className={styles.detailTableWrap}>
                    <table className={styles.detailTable}>
                      <thead>
                        <tr>
                          <th>Hạng</th>
                          <th>Ngựa</th>
                          <th>Người nhận</th>
                          <th>Vai trò</th>
                          <th>Tiền thưởng</th>
                          <th>Chi trả</th>
                        </tr>
                      </thead>

                      <tbody>
                        {detailPayouts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className={styles.detailEmpty}
                            >
                              Chưa có dữ liệu chi thưởng cho Race
                              này.
                            </td>
                          </tr>
                        ) : (
                          [...detailPayouts]
                            .sort(
                              (a, b) =>
                                a.finishPosition -
                                b.finishPosition
                            )
                            .map((payout) => (
                              <tr key={payout.pursePayoutId}>
                                <td>{payout.finishPosition}</td>
                                <td>{payout.horseName || '—'}</td>
                                <td>
                                  {payout.recipientName || '—'}
                                </td>
                                <td>{payout.role || '—'}</td>
                                <td>
                                  {formatMoney(
                                    payout.calculatedAmount
                                  )}
                                </td>
                                <td>{payout.payoutStatus}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>
                    Khiếu nại
                  </h4>

                  {detailProtests.length === 0 ? (
                    <p className={styles.detailEmptyBox}>
                      Race này chưa có khiếu nại.
                    </p>
                  ) : (
                    <div className={styles.protestList}>
                      {detailProtests.map((protest, index) => (
                        <div
                          key={`${readProtestValue(
                            protest,
                            ['protestId', 'id']
                          )}-${index}`}
                          className={styles.protestItem}
                        >
                          <div className={styles.protestTop}>
                            <strong>
                              Khiếu nại #
                              {readProtestValue(protest, [
                                'protestId',
                                'id',
                              ])}
                            </strong>

                            <span
                              className={styles.protestStatus}
                            >
                              {readProtestValue(protest, [
                                'status',
                                'decision',
                                'rulingStatus',
                              ])}
                            </span>
                          </div>

                          <p>
                            {readProtestValue(protest, [
                              'description',
                              'reason',
                              'content',
                              'notes',
                            ])}
                          </p>

                          <small>
                            Người gửi:{' '}
                            {readProtestValue(protest, [
                              'submittedByName',
                              'protesterName',
                              'createdByName',
                              'userName',
                            ])}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
};

export default RaceOperations;
