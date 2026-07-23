import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiShuffle } from "react-icons/fi";
import {
  getTournaments,
  type RoundResponse,
  type TournamentResponse,
} from "../../services/tournamentService";
import {
  drawPostPositions,
  getRaceSchedule,
  type RaceSchedule,
} from "../../services/schedulingService";
import { adminError, adminLabel, dateTime } from "../../utils/adminLabels";
import styles from "./PostPositionDraw.module.scss";

const PostPositionDraw = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [races, setRaces] = useState<RaceSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawingId, setDrawingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRace, setConfirmRace] = useState<RaceSchedule | null>(null);
  const [expandedRaceIds, setExpandedRaceIds] = useState<Set<number>>(
    () => new Set(),
  );
  const tournamentId = Number(search.get("tournamentId")) || null;
  const roundId = Number(search.get("roundId")) || null;
  const tournament = useMemo(
    () =>
      tournaments.find((item) => item.tournamentId === tournamentId) ?? null,
    [tournaments, tournamentId],
  );
  const round = useMemo<RoundResponse | null>(
    () => tournament?.rounds.find((item) => item.roundId === roundId) ?? null,
    [tournament, roundId],
  );
  const select = useCallback(
    (nextTournament?: number, nextRound?: number) => {
      const params = new URLSearchParams();
      if (nextTournament) params.set("tournamentId", String(nextTournament));
      if (nextRound) params.set("roundId", String(nextRound));
      setSearch(params, { replace: true });
    },
    [setSearch],
  );
  useEffect(() => {
    void getTournaments()
      .then((items) => {
        setTournaments(items);
        const nextTournament =
          items.find((item) => item.tournamentId === tournamentId) ?? items[0];
        const nextRound =
          nextTournament?.rounds.find((item) => item.roundId === roundId) ??
          nextTournament?.rounds[0];
        if (
          nextTournament &&
          nextRound &&
          (nextTournament.tournamentId !== tournamentId ||
            nextRound.roundId !== roundId)
        )
          select(nextTournament.tournamentId, nextRound.roundId);
      })
      .catch((err) => setError(adminError(err)))
      .finally(() => setLoading(false));
  }, [roundId, select, tournamentId]);
  const refresh = useCallback(async (): Promise<RaceSchedule[] | null> => {
    if (!round) {
      setRaces([]);
      return [];
    }
    setLoading(true);
    setError("");
    try {
      const result = await Promise.all(
        round.races.map((race) => getRaceSchedule(race.raceId)),
      );
      const sorted = result.sort((a, b) => a.raceNumber - b.raceNumber);
      setRaces(sorted);
      return sorted;
    } catch (err) {
      setError(adminError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [round]);
  useEffect(() => {
    const requestId = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(requestId);
  }, [refresh]);
  const toggleRaceEntries = (raceId: number) =>
    setExpandedRaceIds((current) => {
      const next = new Set(current);
      if (next.has(raceId)) next.delete(raceId);
      else next.add(raceId);
      return next;
    });
  const draw = async () => {
    if (!confirmRace) return;
    const raceToDraw = confirmRace;
    setDrawingId(raceToDraw.raceId);
    setError("");
    try {
      const result = await drawPostPositions(raceToDraw.raceId);
      setRaces((current) =>
        current.map((race) =>
          race.raceId !== result.raceId
            ? race
            : {
                ...race,
                isPostPositionDrawn: true,
                entries: race.entries.map((entry) => ({
                  ...entry,
                  postPosition:
                    result.assignments.find(
                      (assignment) =>
                        assignment.raceEntryId === entry.raceEntryId,
                    )?.postPosition ?? entry.postPosition,
                })),
              },
        ),
      );
      setConfirmRace(null);
      const refreshedRaces = await refresh();
      const roundIsFullyDrawn =
        refreshedRaces != null &&
        refreshedRaces.length > 0 &&
        refreshedRaces.every((race) => race.isPostPositionDrawn);

      if (roundIsFullyDrawn) {
        navigate(`/admin/race-operations?${search.toString()}`, {
          replace: true,
        });
        return;
      }

      setNotice(
        `Đã bốc thăm vị trí xuất phát cho cuộc đua #${raceToDraw.raceNumber}.`,
      );
    } catch (err) {
      setConfirmRace(null);
      const refreshedRaces = await refresh();
      const latestRace = refreshedRaces?.find(
        (race) => race.raceId === raceToDraw.raceId,
      );

      // Nếu request trước đó đã được xử lý (Admin khác hoặc request lặp), dữ liệu
      // mới là nguồn đúng: không hiển thị lỗi đỏ cho một race đã bốc thăm thành công.
      if (latestRace?.isPostPositionDrawn) {
        const roundIsFullyDrawn =
          refreshedRaces?.length > 0 &&
          refreshedRaces.every((race) => race.isPostPositionDrawn);
        if (roundIsFullyDrawn) {
          navigate(`/admin/race-operations?${search.toString()}`, {
            replace: true,
          });
          return;
        }
        setError("");
        setNotice(
          `Cuộc đua #${raceToDraw.raceNumber} đã có vị trí xuất phát. Dữ liệu đã được cập nhật.`,
        );
        return;
      }

      setError(adminError(err));
    } finally {
      setDrawingId(null);
    }
  };
  return (
    <div className={styles.page}>
      <header>
        <div>
          <h1>Bốc thăm vị trí xuất phát</h1>
        </div>
        <button
          className={styles.secondary}
          onClick={() =>
            navigate(`/admin/race-operations?${search.toString()}`)
          }
        >
          <FiArrowLeft /> Về phân cuộc đua
        </button>
      </header>
      {notice && <div className={styles.notice}>{notice}</div>}
      {error && <div className={styles.error}>{error}</div>}
      <section className={styles.card}>
        <div className={styles.selectors}>
          <label>
            Giải đấu
            <select
              value={tournamentId ?? ""}
              onChange={(event) => {
                const id = Number(event.target.value);
                select(
                  id,
                  tournaments.find((item) => item.tournamentId === id)
                    ?.rounds[0]?.roundId,
                );
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
              value={roundId ?? ""}
              disabled={!tournament}
              onChange={(event) =>
                select(tournamentId ?? undefined, Number(event.target.value))
              }
            >
              <option value="">-- Chọn vòng đấu --</option>
              {tournament?.rounds.map((item) => (
                <option key={item.roundId} value={item.roundId}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {tournament && (
          <div className={styles.venue}>
            <strong>
              {tournament.venueName ?? "Chưa gán trường đua"}
              {tournament.venueCity ? ` · ${tournament.venueCity}` : ""}
            </strong>
            <span>Số làn: {tournament.laneCount ?? "—"}</span>
            <span>Sức chứa mỗi cuộc đua: {tournament.raceCapacity ?? "—"}</span>
          </div>
        )}
      </section>
      <section className={styles.raceGrid}>
        {loading ? (
          <p className={styles.empty}>Đang tải các cuộc đua…</p>
        ) : !round ? (
          <p className={styles.empty}>Chọn vòng đấu để xem các cuộc đua.</p>
        ) : (
          races.map((race) => {
            const eligible = race.entries.filter(
              (entry) => entry.status === "Confirmed",
            );
            const canDraw = !race.isPostPositionDrawn && eligible.length >= 2;
            const isExpanded = expandedRaceIds.has(race.raceId);
            const sortedEntries = race.entries
              .slice()
              .sort(
                (a, b) => (a.postPosition ?? 999) - (b.postPosition ?? 999),
              );
            return (
              <article className={styles.raceCard} key={race.raceId}>
                <div className={styles.raceHead}>
                  <div>
                    <h2>Cuộc đua #{race.raceNumber}</h2>
                    <p>{dateTime(race.scheduledTime)}</p>
                  </div>
                  <span>
                    {race.entries.length}/
                    {race.raceCapacity ?? tournament?.raceCapacity ?? "—"}
                  </span>
                </div>
                {race.entries.length === 0 ? (
                  <p className={styles.empty}>
                    Chưa có ngựa nào — hãy phân cuộc đua trước.
                  </p>
                ) : (
                  <>
                    <div className={styles.raceSummary}>
                      <span>
                        {race.isPostPositionDrawn
                          ? "Đã có vị trí xuất phát"
                          : `${eligible.length} cặp sẵn sàng bốc thăm`}
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
                      <ul>
                        {sortedEntries.map((entry) => (
                          <li key={entry.raceEntryId}>
                            <b>{entry.postPosition ?? "—"}</b>
                            <span>
                              <strong>{entry.horseName}</strong>
                              <small>
                                Nài: {entry.jockeyName} ·{" "}
                                {adminLabel(entry.status)}
                              </small>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {!race.isPostPositionDrawn && eligible.length < 2 && (
                  <p className={styles.warning}>
                    Cần ít nhất 2 ngựa hợp lệ mới bốc thăm được (hiện có{" "}
                    {eligible.length}).
                  </p>
                )}
                <footer>
                  {race.isPostPositionDrawn ? (
                    <span className={styles.drawn}>Đã bốc thăm</span>
                  ) : (
                    <button
                      className={styles.primary}
                      disabled={!canDraw || drawingId === race.raceId}
                      onClick={() => setConfirmRace(race)}
                    >
                      <FiShuffle /> Bốc thăm
                    </button>
                  )}
                </footer>
              </article>
            );
          })
        )}
      </section>
      {confirmRace && (
        <div className={styles.modalLayer}>
          <div className={styles.modal}>
            <h2>Bốc thăm vị trí xuất phát</h2>
            <p>
              Xác nhận bốc thăm cho cuộc đua #{confirmRace.raceNumber}? Kết quả
              do hệ thống tạo và không thể bốc lại.
            </p>
            <div>
              <button
                className={styles.secondary}
                onClick={() => setConfirmRace(null)}
              >
                Hủy
              </button>
              <button
                className={styles.primary}
                disabled={drawingId === confirmRace.raceId}
                onClick={() => void draw()}
              >
                {drawingId === confirmRace.raceId
                  ? "Đang bốc thăm…"
                  : "Xác nhận bốc thăm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PostPositionDraw;
