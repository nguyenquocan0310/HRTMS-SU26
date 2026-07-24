import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowRight,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiFlag,
  FiMapPin,
  FiMove,
  FiRefreshCw,
  FiShuffle,
  FiUsers,
} from "react-icons/fi";
import {
  getTournaments,
  type RoundResponse,
  type TournamentResponse,
} from "../../services/tournamentService";
import {
  autoAllocate,
  finalizeRound,
  getRaceSchedule,
  getRoundWaitlist,
  moveRaceEntry,
  previewAutoAllocate,
  type AutoAllocateResult,
  type FinalizeResult,
  type RaceSchedule,
  type ScheduledEntry,
  type WaitlistEntry,
} from "../../services/schedulingService";
import { adminError, adminLabel, dateTime } from "../../utils/adminLabels";
import styles from "./RaceOperation.module.scss";

const RaceOperations = () => {
  const [search, setSearch] = useSearchParams();
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [schedules, setSchedules] = useState<RaceSchedule[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [preview, setPreview] = useState<AutoAllocateResult | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadingRound, setLoadingRound] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allocateConfirm, setAllocateConfirm] = useState(false);
  const [finalizeConfirm, setFinalizeConfirm] = useState(false);
  const [move, setMove] = useState<{
    entry: ScheduledEntry;
    sourceRaceId: number;
    targetRaceId: number;
  } | null>(null);
  const [expandedRaceIds, setExpandedRaceIds] = useState<Set<number>>(
    () => new Set(),
  );

  const selectedTournamentId = Number(search.get("tournamentId")) || null;
  const selectedRoundId = Number(search.get("roundId")) || null;
  const tournament = useMemo(
    () =>
      tournaments.find((item) => item.tournamentId === selectedTournamentId) ??
      null,
    [tournaments, selectedTournamentId],
  );
  const round = useMemo<RoundResponse | null>(
    () =>
      tournament?.rounds.find((item) => item.roundId === selectedRoundId) ??
      null,
    [tournament, selectedRoundId],
  );

  const setSelection = useCallback(
    (tournamentId?: number, roundId?: number) => {
      const next = new URLSearchParams();
      if (tournamentId) next.set("tournamentId", String(tournamentId));
      if (roundId) next.set("roundId", String(roundId));
      setPreview(null);
      setFinalizeResult(null);
      setSearch(next, { replace: true });
    },
    [setSearch],
  );

  const toggleRaceEntries = (raceId: number) =>
    setExpandedRaceIds((current) => {
      const next = new Set(current);
      if (next.has(raceId)) next.delete(raceId);
      else next.add(raceId);
      return next;
    });

  useEffect(() => {
    void getTournaments()
      .then((data) => {
        setTournaments(data);
        const initialTournament =
          data.find((item) => item.tournamentId === selectedTournamentId) ??
          data[0];
        if (!initialTournament) return;
        const initialRound =
          initialTournament.rounds.find(
            (item) => item.roundId === selectedRoundId,
          ) ?? initialTournament.rounds[0];
        if (
          initialRound &&
          (!selectedTournamentId ||
            !selectedRoundId ||
            initialTournament.tournamentId !== selectedTournamentId)
        ) {
          setSelection(initialTournament.tournamentId, initialRound.roundId);
        }
      })
      .catch((err) =>
        setError(adminError(err, "Không tải được danh sách giải đấu.")),
      )
      .finally(() => setLoading(false));
  }, [selectedRoundId, selectedTournamentId, setSelection]);

  const refreshRound = useCallback(async () => {
    if (!round) {
      setSchedules([]);
      setWaitlist([]);
      setPreview(null);
      return;
    }
    setLoadingRound(true);
    setError("");
    try {
      const [races, waiting] = await Promise.all([
        Promise.all(round.races.map((race) => getRaceSchedule(race.raceId))),
        getRoundWaitlist(round.roundId),
      ]);
      setSchedules(races.sort((a, b) => a.raceNumber - b.raceNumber));
      setWaitlist(waiting);
      // Preview chỉ hợp lệ trước khi chốt phân bổ. Sau khi phân xong API trả
      // ROUND_ALREADY_ALLOCATED; đó là trạng thái bình thường, không được làm mất
      // lịch race đã tải thành công.
      try {
        setPreview(await previewAutoAllocate(round.roundId));
      } catch {
        setPreview(null);
      }
    } catch (err) {
      setError(adminError(err, "Không tải được thông tin vòng đấu."));
    } finally {
      setLoadingRound(false);
    }
  }, [round]);

  useEffect(() => {
    const requestId = window.setTimeout(() => void refreshRound(), 0);
    return () => window.clearTimeout(requestId);
  }, [refreshRound]);

  const allocate = async () => {
    if (!round) return;
    setWorking(true);
    setAllocateConfirm(false);
    setError("");
    try {
      const result = await autoAllocate(round.roundId);
      setPreview(result);
      setNotice(
        `Đã chốt danh sách: ${result.allocatedCount} cặp được phân vào cuộc đua, ${result.waitlistedCount} cặp trong danh sách chờ.`,
      );
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
    setError("");
    try {
      const result = await finalizeRound(round.roundId);
      setFinalizeResult(result);
      setPreview(result.allocation);
      setNotice(
        "Đã hoàn tất xử lý vòng đấu. Xem chi tiết các cuộc đua được bốc thăm và bị bỏ qua bên dưới.",
      );
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
    setError("");
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

  const capacity =
    tournament?.raceCapacity ?? schedules[0]?.raceCapacity ?? null;
  const allocatedTotal = schedules.reduce(
    (total, race) => total + race.entries.length,
    0,
  );
  const hasAllocation = allocatedTotal > 0;
  const allDrawn =
    schedules.length > 0 && schedules.every((race) => race.isPostPositionDrawn);
  const poolSize = preview?.poolSize ?? allocatedTotal + waitlist.length;
  const raceReadyCount = schedules.filter(
    (race) => race.entries.length > 0 && !race.isPostPositionDrawn,
  ).length;
  const roundReady = hasAllocation && allDrawn;

  const nextAction = !hasAllocation
    ? {
        title: "Phân cặp vào các cuộc đua",
        description:
          "Hệ thống sẽ phân các cặp đã đủ điều kiện vào những cuộc đua còn chỗ trong vòng này.",
        icon: <FiFlag />,
        primaryLabel: "Phân bổ",
        primaryAction: () => setAllocateConfirm(true),
        primaryDisabled: !preview || preview.allocatedCount === 0,
      }
    : !allDrawn
      ? {
          title: `Bốc thăm vị trí xuất phát${raceReadyCount ? ` cho ${raceReadyCount} cuộc đua` : ""}`,
          description:
            "Hoàn tất bốc thăm cho các cuộc đua đủ điều kiện. Các cuộc đua chưa đủ cặp sẽ được giữ lại để xử lý sau.",
          icon: <FiShuffle />,
          primaryLabel: "Hoàn tất phân race và bốc thăm",
          primaryAction: () => setFinalizeConfirm(true),
          primaryDisabled: false,
        }
      : {
          title: "Vòng đấu đã sẵn sàng chuẩn bị cuộc đua",
          description:
            "Tất cả cặp đã được phân cuộc đua và có vị trí xuất phát. Bạn có thể tiếp tục phân công trọng tài và bác sĩ.",
          icon: <FiCheck />,
          primaryLabel: "Làm mới dữ liệu vòng đấu",
          primaryAction: () => void refreshRound(),
          primaryDisabled: false,
        };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.breadcrumb}>
            <span>Điều hành giải đấu</span>
            <FiChevronRight size={14} />
            <span>Vòng đấu</span>
          </div>
          <h1>Phân cuộc đua</h1>
          <p>
            Phân cặp, theo dõi trạng thái và chuẩn bị danh sách xuất phát cho
            từng cuộc đua.
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => void refreshRound()}
          disabled={loadingRound}
        >
          <FiRefreshCw className={loadingRound ? styles.spinning : undefined} />{" "}
          Làm mới
        </button>
      </header>

      {notice && (
        <div className={styles.notice} role="status">
          <FiCheck />
          {notice}
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          <FiAlertTriangle />
          {error}
        </div>
      )}

      <section className={styles.contextPanel} aria-label="Chọn vòng đấu">
        <div className={styles.selectors}>
          <label>
            Giải đấu
            <select
              value={selectedTournamentId ?? ""}
              onChange={(event) => {
                const id = Number(event.target.value);
                const next = tournaments.find(
                  (item) => item.tournamentId === id,
                );
                setSelection(id, next?.rounds[0]?.roundId);
              }}
            >
              <option value="">-- Chọn giải đấu --</option>
              {tournaments.map((item) => (
                <option key={item.tournamentId} value={item.tournamentId}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vòng đấu
            <select
              value={selectedRoundId ?? ""}
              disabled={!tournament}
              onChange={(event) =>
                setSelection(
                  selectedTournamentId ?? undefined,
                  Number(event.target.value),
                )
              }
            >
              <option value="">-- Chọn vòng đấu --</option>
              {tournament?.rounds.map((item) => (
                <option key={item.roundId} value={item.roundId}>
                  {item.name} · {item.races.length} cuộc đua ·{" "}
                  {adminLabel(item.status)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tournament && (
          <div className={styles.venue}>
            <span className={styles.venueName}>
              <FiMapPin />
              {tournament.venueName ?? "Chưa gán trường đua"}
              {tournament.venueCity ? ` · ${tournament.venueCity}` : ""}
            </span>
            <span>
              Mặt sân: <strong>{adminLabel(tournament.trackType)}</strong>
            </span>
            <span>
              Số làn: <strong>{tournament.laneCount ?? "—"}</strong>
            </span>
            <span>
              Chiều dài:{" "}
              <strong>
                {tournament.trackLengthMeters
                  ? `${tournament.trackLengthMeters.toLocaleString("vi-VN")} m`
                  : "—"}
              </strong>
            </span>
            <span>
              Sức chứa/cuộc đua: <strong>{capacity ?? "—"}</strong>
            </span>
          </div>
        )}
      </section>

      {loading || loadingRound ? (
        <LoadingState />
      ) : !round ? (
        <EmptyState />
      ) : (
        <>
          <section
            className={`${styles.nextAction} ${roundReady ? styles.readyAction : ""}`}
          >
            <div className={styles.actionIcon}>{nextAction.icon}</div>
            <div className={styles.actionCopy}>
              <h2>{nextAction.title}</h2>
              <p>{nextAction.description}</p>
              <div className={styles.actionMeta}>
                <span>
                  <FiUsers />
                  {poolSize} cặp trong danh sách
                </span>
                <span>
                  <FiFlag />
                  {round.races.length} cuộc đua
                </span>
                {waitlist.length > 0 && (
                  <span className={styles.waitingMeta}>
                    <FiClock />
                    {waitlist.length} cặp chờ
                  </span>
                )}
              </div>
            </div>
            {preview && (
              <div className={styles.paidPairings}>
                <div className={styles.paidPairingsHeader}>
                  <div>
                    <h3>Pairing đã đóng phí</h3>
                    <p>
                      Danh sách cặp đủ điều kiện được dùng để phân bổ trong vòng
                      này.
                    </p>
                  </div>
                  <span>{preview.selectedPool.length}</span>
                </div>
                {preview.selectedPool.length === 0 ? (
                  <p className={styles.noPaidPairings}>
                    Chưa có pairing nào đủ điều kiện sau khi đối chiếu lệ phí.
                  </p>
                ) : (
                  <ul>
                    {preview.selectedPool.map((pairing) => (
                      <li key={pairing.pairingId}>
                        <div>
                          <strong>{pairing.horseName}</strong>
                          <span>Nài ngựa: {pairing.jockeyName}</span>
                        </div>
                        <time>
                          {pairing.feeVerifiedAt
                            ? `Đã đóng phí ${dateTime(pairing.feeVerifiedAt)}`
                            : "Đã xác nhận lệ phí"}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {roundReady ? (
              <div
                className={styles.readyMetrics}
                aria-label="Tóm tắt vòng đấu"
              >
                <div>
                  <span>Đã phân bổ</span>
                  <strong>{allocatedTotal} cặp</strong>
                </div>
                <div>
                  <span>Cuộc đua sẵn sàng</span>
                  <strong>{schedules.length} race</strong>
                </div>
                <div>
                  <span>Vòng hiện tại</span>
                  <strong>{round?.name ?? "—"}</strong>
                </div>
              </div>
            ) : (
              <div className={styles.actionButtons}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={working || nextAction.primaryDisabled}
                  onClick={nextAction.primaryAction}
                >
                  {working ? "Đang xử lý…" : nextAction.primaryLabel}
                  <FiArrowRight />
                </button>
              </div>
            )}
          </section>

          {preview && !hasAllocation && (
            <section className={styles.previewPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Dự kiến phân bổ</h2>
                  <p>
                    Kết quả được tự động tính từ danh sách pairing đã đóng phí.
                  </p>
                </div>
                <span className={styles.previewBadge}>Chưa phân bổ</span>
              </div>
              <div className={styles.stats}>
                {[
                  ["Cặp đủ điều kiện", preview.poolSize],
                  ["Sức chứa mỗi cuộc đua", preview.capacityPerRace],
                  ["Tổng sức chứa", preview.totalCapacity],
                  ["Được phân", preview.allocatedCount],
                  ["Danh sách chờ", preview.waitlistedCount],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              {preview.warnings.length > 0 && (
                <div className={styles.warnings}>
                  {preview.warnings.map((warning) => (
                    <p key={warning}>
                      <FiAlertTriangle />
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </section>
          )}

          <section
            className={`${styles.contentGrid} ${
              waitlist.length === 0 ? styles.contentGridSingle : ""
            }`}
          >
            <div className={styles.racesPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Cuộc đua trong vòng</h2>
                  <p>
                    Trạng thái phân cặp và vị trí xuất phát của từng cuộc đua.
                  </p>
                </div>
                <span className={styles.countBadge}>{schedules.length}</span>
              </div>
              <div className={styles.raceList}>
                {schedules.map((race) => {
                  const raceCapacity = race.raceCapacity ?? capacity ?? 0;
                  const isFull =
                    raceCapacity > 0 && race.entries.length >= raceCapacity;
                  const isExpanded = expandedRaceIds.has(race.raceId);
                  return (
                    <article className={styles.raceRow} key={race.raceId}>
                      <div className={styles.raceNumber}>
                        <span>Cuộc đua</span>
                        <strong>#{race.raceNumber}</strong>
                      </div>
                      <div className={styles.raceInfo}>
                        <h3>{dateTime(race.scheduledTime)}</h3>
                        <p>
                          {race.entries.length
                            ? `${race.entries.length} cặp đã được phân vào cuộc đua`
                            : "Chưa có cặp nào được phân vào cuộc đua"}
                        </p>
                      </div>
                      <div className={styles.raceStatus}>
                        <StatusPill
                          tone={
                            isFull
                              ? "green"
                              : race.entries.length
                                ? "amber"
                                : "slate"
                          }
                        >
                          {isFull
                            ? "Đã phân đủ"
                            : race.entries.length
                              ? "Đã phân một phần"
                              : "Chưa phân"}
                        </StatusPill>
                        <StatusPill
                          tone={
                            race.isPostPositionDrawn
                              ? "green"
                              : race.entries.length
                                ? "amber"
                                : "slate"
                          }
                        >
                          {race.isPostPositionDrawn
                            ? "Đã có vị trí xuất phát"
                            : "Chưa bốc thăm"}
                        </StatusPill>
                      </div>
                      <span className={styles.capacity}>
                        {race.entries.length}/{raceCapacity || "—"} cặp
                      </span>
                      {race.entries.length > 0 && (
                        <>
                          <div className={styles.raceEntrySummary}>
                            <span>
                              {race.isPostPositionDrawn
                                ? "Danh sách đã có vị trí xuất phát."
                                : "Xem pairing và điều chỉnh phân bổ trước khi bốc thăm."}
                            </span>
                            <button
                              type="button"
                              className={styles.showEntries}
                              onClick={() => toggleRaceEntries(race.raceId)}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded
                                ? "Ẩn danh sách"
                                : `Xem ${race.entries.length} cặp`}
                            </button>
                          </div>
                          {isExpanded && (
                            <ul
                              className={styles.raceEntries}
                              aria-label={`Danh sách pairing cuộc đua ${race.raceNumber}`}
                            >
                              {race.entries.map((entry) => (
                                <li
                                  className={styles.raceEntry}
                                  key={entry.raceEntryId}
                                >
                                  <div className={styles.entryIdentity}>
                                    <strong>{entry.horseName}</strong>
                                    <span>
                                      Nài ngựa: {entry.jockeyName}
                                      {entry.ownerName
                                        ? ` · Chủ ngựa: ${entry.ownerName}`
                                        : ""}
                                    </span>
                                  </div>
                                  <div className={styles.entryMeta}>
                                    <StatusPill
                                      tone={
                                        entry.status === "Confirmed"
                                          ? "green"
                                          : "amber"
                                      }
                                    >
                                      {adminLabel(entry.status)}
                                    </StatusPill>
                                    <span>
                                      {entry.postPosition
                                        ? `Vị trí #${entry.postPosition}`
                                        : "Chưa bốc thăm"}
                                    </span>
                                  </div>
                                  {!race.isPostPositionDrawn && (
                                    <button
                                      type="button"
                                      className={styles.moveButton}
                                      onClick={() =>
                                        setMove({
                                          entry,
                                          sourceRaceId: race.raceId,
                                          targetRaceId: 0,
                                        })
                                      }
                                    >
                                      <FiMove /> Chuyển
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            {waitlist.length > 0 && (
              <aside className={styles.waitingPanel}>
                <div className={styles.panelHeading}>
                  <div>
                    <h2>Danh sách chờ</h2>
                    <p>Các cặp chưa có vị trí phù hợp.</p>
                  </div>
                  <span className={styles.waitingCount}>{waitlist.length}</span>
                </div>
                <ol className={styles.waitlist}>
                  {waitlist.map((entry) => (
                    <li key={entry.pairingId}>
                      <b>{entry.position}</b>
                      <span>
                        <strong>{entry.horseName}</strong>
                        <small>
                          Cặp đấu #{entry.pairingId} · Đã xác nhận lệ phí{" "}
                          {dateTime(entry.feeVerifiedAt)}
                        </small>
                      </span>
                    </li>
                  ))}
                </ol>
              </aside>
            )}
          </section>

          {finalizeResult && (
            <section className={styles.resultPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Kết quả hoàn tất vòng</h2>
                  <p>Bản tóm tắt lần xử lý gần nhất.</p>
                </div>
                <FiCheck className={styles.resultIcon} />
              </div>
              <div className={styles.resultGrid}>
                <div>
                  <span>Phân cuộc đua</span>
                  <strong>
                    {finalizeResult.allocation.allocatedCount}/
                    {finalizeResult.allocation.poolSize} cặp
                  </strong>
                </div>
                <div>
                  <span>Bốc thăm thành công</span>
                  <strong>{finalizeResult.draws.length} cuộc đua</strong>
                </div>
                <div>
                  <span>Cuộc đua được bỏ qua</span>
                  <strong>{finalizeResult.skippedDraws.length}</strong>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {allocateConfirm && (
        <Modal
          title="Chốt danh sách và phân cuộc đua"
          onCancel={() => setAllocateConfirm(false)}
          onConfirm={() => void allocate()}
          confirm="Chốt phân cuộc đua"
          loading={working}
        >
          Hệ thống sẽ lưu phân bổ cho toàn bộ vòng đấu và danh sách chờ. Bạn có
          chắc chắn muốn tiếp tục?
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
          Hệ thống sẽ phân toàn bộ cặp đủ điều kiện và bốc thăm độc lập từng
          cuộc đua. Những cuộc đua chưa đủ điều kiện vẫn được giữ lại để xử lý
          sau.
        </Modal>
      )}
      {move && (
        <div className={styles.modalLayer}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-title"
          >
            <h2 id="move-title">Điều chỉnh phân bổ</h2>
            <p>
              Chuyển một cặp sang cuộc đua khác trong cùng vòng, trước khi bốc
              thăm vị trí xuất phát.
            </p>
            <label>
              Cuộc đua đích
              <select
                value={move.targetRaceId}
                onChange={(event) =>
                  setMove({ ...move, targetRaceId: Number(event.target.value) })
                }
              >
                <option value="0">-- Chọn cuộc đua --</option>
                {schedules
                  .filter((race) => race.raceId !== move.sourceRaceId)
                  .map((race) => (
                    <option key={race.raceId} value={race.raceId}>
                      Cuộc đua #{race.raceNumber} · {race.entries.length}/
                      {race.raceCapacity ?? capacity ?? "—"}
                    </option>
                  ))}
              </select>
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setMove(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={working || !move.targetRaceId}
                onClick={() => void submitMove()}
              >
                <FiArrowRight /> Chuyển cuộc đua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusPill = ({
  tone,
  children,
}: {
  tone: "green" | "amber" | "slate";
  children: React.ReactNode;
}) => (
  <span className={`${styles.statusPill} ${styles[tone]}`}>{children}</span>
);

const LoadingState = () => (
  <section className={styles.placeholder}>
    <FiRefreshCw className={styles.spinning} />
    <p>Đang tải dữ liệu vòng đấu…</p>
  </section>
);
const EmptyState = () => (
  <section className={styles.placeholder}>
    <FiFlag />
    <h2>Chọn vòng đấu để bắt đầu điều hành</h2>
    <p>Chọn giải đấu và vòng đấu ở phía trên để xem danh sách cuộc đua.</p>
  </section>
);

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
  <div className={styles.modalLayer} role="presentation">
    <div
      className={styles.modal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <h2 id="modal-title">{title}</h2>
      <p>{children}</p>
      <div className={styles.modalActions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Hủy
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={loading}
          onClick={onConfirm}
        >
          {loading ? "Đang xử lý…" : confirm}
        </button>
      </div>
    </div>
  </div>
);

export default RaceOperations;
