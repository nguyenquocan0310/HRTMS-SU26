import { useEffect, useMemo, useState } from 'react';
import {
  FiDownload,
  FiRefreshCw,
} from 'react-icons/fi';

import {
  getTournaments,
  type TournamentResponse,
} from '../../services/tournamentService';

import {
  getEarningsHistory,
  getRacePayoutSummary,
  updatePayoutStatus,
  type EarningsHistoryItem,
  type PursePayoutItem,
  type RacePayoutSummary,
} from '../../services/pursePayoutService';

import styles from './PursePayouts.module.scss';

interface RaceRef {
  raceId: number;
  raceNumber: number;
  roundName: string;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const PursePayouts = () => {
  const [tournaments, setTournaments] = useState<
    TournamentResponse[]
  >([]);

  const [selectedTournamentId, setSelectedTournamentId] =
    useState<number | null>(null);

  const [raceSummaries, setRaceSummaries] = useState<
    RacePayoutSummary[]
  >([]);

  const [earningsHistory, setEarningsHistory] = useState<
    EarningsHistoryItem[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [updatingPayoutId, setUpdatingPayoutId] =
    useState<number | null>(null);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getTournaments()
      .then((items) => {
        setTournaments(items);

        if (items.length > 0) {
          setSelectedTournamentId(items[0].tournamentId);
        }
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Không tải được danh sách giải đấu.'
        );
      });
  }, []);

  const selectedTournament = useMemo(
    () =>
      tournaments.find(
        (item) =>
          item.tournamentId === selectedTournamentId
      ) ?? null,
    [tournaments, selectedTournamentId]
  );

  const selectedRaceRefs = useMemo<RaceRef[]>(() => {
    if (!selectedTournament) {
      return [];
    }

    return selectedTournament.rounds.flatMap((round) =>
      round.races.map((race) => ({
        raceId: race.raceId,
        raceNumber: race.raceNumber,
        roundName: round.name,
      }))
    );
  }, [selectedTournament]);

  const loadData = async () => {
    if (!selectedTournamentId) {
      setRaceSummaries([]);
      setEarningsHistory([]);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const summaries = await Promise.all(
        selectedRaceRefs.map((race) =>
          getRacePayoutSummary(race.raceId)
        )
      );

      const history = await getEarningsHistory();

      setRaceSummaries(summaries);
      setEarningsHistory(history);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không tải được dữ liệu quỹ và chi thưởng.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedTournamentId) {
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournamentId, selectedRaceRefs.length]);

  const allPayouts = useMemo(
    () =>
      raceSummaries.flatMap((summary) =>
        summary.payouts.map((payout) => ({
          ...payout,
          raceId: summary.raceId,
          raceNumber: summary.raceNumber,
          roundName: summary.roundName,
        }))
      ),
    [raceSummaries]
  );

  const summary = useMemo(() => {
    const initialFund = raceSummaries.reduce(
      (total, race) => total + race.purseAmount,
      0
    );

    const allocated = raceSummaries.reduce(
      (total, race) => total + race.totalAllocated,
      0
    );

    const unallocated = raceSummaries.reduce(
      (total, race) => total + race.remainderAmount,
      0
    );

    const paid = allPayouts
      .filter(
        (item) =>
          item.payoutStatus.toLowerCase() === 'paid'
      )
      .reduce(
        (total, item) =>
          total + item.calculatedAmount,
        0
      );

    return {
      initialFund,
      allocated,
      unallocated,
      paid,
      remaining: Math.max(0, initialFund - paid),
    };
  }, [raceSummaries, allPayouts]);

  const handleChangeStatus = async (
    payout: PursePayoutItem
  ) => {
    const nextStatus =
      payout.payoutStatus === 'Paid'
        ? 'Unpaid'
        : 'Paid';

    setUpdatingPayoutId(payout.pursePayoutId);
    setError('');
    setMessage('');

    try {
      await updatePayoutStatus(
        payout.pursePayoutId,
        nextStatus
      );

      setMessage(
        `Đã cập nhật trạng thái payout #${payout.pursePayoutId} thành ${nextStatus}.`
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không cập nhật được trạng thái chi trả.'
      );
    } finally {
      setUpdatingPayoutId(null);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      [
        'Vòng',
        'Race',
        'Người nhận',
        'Vai trò',
        'Ngựa',
        'Hạng',
        'Tiền thưởng',
        'Trạng thái',
      ],
      ...allPayouts.map((item) => [
        item.roundName,
        `Race #${item.raceNumber}`,
        item.recipientName,
        item.role,
        item.horseName,
        String(item.finishPosition),
        String(item.calculatedAmount),
        item.payoutStatus,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob(
      ['\uFEFF', csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `purse-payouts-${
      selectedTournament?.name ?? 'tournament'
    }.csv`;

    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>
            Quỹ &amp; chi thưởng
          </h1>

          <p className={styles.subtext}>
            Theo dõi ngân sách race, thực chi và trạng thái
            phát thưởng.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={loadData}
            disabled={loading}
          >
            <FiRefreshCw size={16} />
            Tải lại
          </button>

          <button
            type="button"
            className={styles.ghostBtn}
            onClick={handleExportCsv}
            disabled={allPayouts.length === 0}
          >
            <FiDownload size={16} />
            Xuất CSV
          </button>
        </div>
      </div>

      <div className={styles.filterSection}>
        <label className={styles.label}>
          Giải đấu
        </label>

        <select
          className={styles.select}
          value={selectedTournamentId ?? ''}
          onChange={(event) =>
            setSelectedTournamentId(
              Number(event.target.value)
            )
          }
        >
          {tournaments.length === 0 ? (
            <option value="">
              -- Chưa có giải đấu --
            </option>
          ) : (
            tournaments.map((tournament) => (
              <option
                key={tournament.tournamentId}
                value={tournament.tournamentId}
              >
                {tournament.name}
              </option>
            ))
          )}
        </select>
      </div>

      {error && (
        <div className={styles.errorBox}>{error}</div>
      )}

      {message && (
        <div className={styles.successBox}>
          {message}
        </div>
      )}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <span>Quỹ ban đầu</span>
          <strong>
            {formatMoney(summary.initialFund)}
          </strong>
        </div>

        <div className={styles.summaryItem}>
          <span>Đã phân bổ</span>
          <strong>
            {formatMoney(summary.allocated)}
          </strong>
        </div>

        <div className={styles.summaryItem}>
          <span>Chưa phân bổ</span>
          <strong>
            {formatMoney(summary.unallocated)}
          </strong>
        </div>

        <div className={styles.summaryItem}>
          <span>Thực chi phát sinh</span>
          <strong>{formatMoney(summary.paid)}</strong>
        </div>

        <div className={styles.summaryItem}>
          <span>Số tiền còn lại</span>
          <strong>
            {formatMoney(summary.remaining)}
          </strong>
          <small>Sau khi trừ thực chi</small>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Phân bổ theo vòng / race
        </h2>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Vòng / race</th>
                <th>Trạng thái</th>
                <th>Ngân sách</th>
                <th>Thực chi</th>
                <th>Phần dư</th>
                <th>Quỹ sau race</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.emptyCell}
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : raceSummaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.emptyCell}
                  >
                    Chưa có dữ liệu Race.
                  </td>
                </tr>
              ) : (
                raceSummaries.map((race) => {
                  const paid = race.payouts
                    .filter(
                      (item) =>
                        item.payoutStatus === 'Paid'
                    )
                    .reduce(
                      (total, item) =>
                        total + item.calculatedAmount,
                      0
                    );

                  return (
                    <tr key={race.raceId}>
                      <td>
                        <strong>{race.roundName}</strong>
                        {' · '}Race #{race.raceNumber}
                      </td>

                      <td>{race.raceStatus}</td>
                      <td>{formatMoney(race.purseAmount)}</td>
                      <td>{formatMoney(paid)}</td>
                      <td>
                        {formatMoney(race.remainderAmount)}
                      </td>
                      <td>
                        {formatMoney(
                          Math.max(
                            0,
                            race.purseAmount - paid
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          Chi tiết payout
        </h2>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Race</th>
                <th>Người nhận</th>
                <th>Vai trò</th>
                <th>Ngựa</th>
                <th>Hạng</th>
                <th>Tiền thưởng</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {allPayouts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className={styles.emptyCell}
                  >
                    Race chưa Official hoặc chưa sinh payout.
                  </td>
                </tr>
              ) : (
                allPayouts.map((payout) => (
                  <tr key={payout.pursePayoutId}>
                    <td>
                      {payout.roundName} · Race #
                      {payout.raceNumber}
                    </td>

                    <td>{payout.recipientName}</td>
                    <td>{payout.role}</td>
                    <td>{payout.horseName}</td>
                    <td>{payout.finishPosition}</td>

                    <td>
                      {formatMoney(
                        payout.calculatedAmount
                      )}
                    </td>

                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          payout.payoutStatus === 'Paid'
                            ? styles.paid
                            : styles.unpaid
                        }`}
                      >
                        {payout.payoutStatus}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={styles.statusBtn}
                        onClick={() =>
                          handleChangeStatus(payout)
                        }
                        disabled={
                          updatingPayoutId ===
                          payout.pursePayoutId
                        }
                      >
                        {updatingPayoutId ===
                        payout.pursePayoutId
                          ? 'Đang xử lý...'
                          : payout.payoutStatus === 'Paid'
                            ? 'Đánh dấu Unpaid'
                            : 'Đánh dấu Paid'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              Lịch sử thu nhập
            </h2>

            <p className={styles.sectionSubtext}>
              Thống kê toàn hệ thống.
            </p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Người nhận</th>
                <th>Vai trò</th>
                <th>Tổng thu nhập</th>
                <th>Đã chi</th>
                <th>Chưa chi</th>
                <th>Số payout</th>
              </tr>
            </thead>

            <tbody>
              {earningsHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={styles.emptyCell}
                  >
                    Chưa có lịch sử thu nhập.
                  </td>
                </tr>
              ) : (
                earningsHistory.map((item) => (
                  <tr
                    key={`${item.recipientUserId}-${item.role}`}
                  >
                    <td>{item.recipientName}</td>
                    <td>{item.role}</td>
                    <td>
                      {formatMoney(item.totalEarnings)}
                    </td>
                    <td>{formatMoney(item.paidAmount)}</td>
                    <td>
                      {formatMoney(item.unpaidAmount)}
                    </td>
                    <td>{item.payoutCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default PursePayouts;