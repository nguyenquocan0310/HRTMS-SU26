import { useState } from 'react';
import { FiShuffle, FiCheckCircle } from 'react-icons/fi';
import type { Round } from '../TournamentBuilder';
import styles from './TabPostPositionDraw.module.scss';

interface Props {
  rounds: Round[];
  onChange: (rounds: Round[]) => void;
  readOnly?: boolean;
}

const TabPostPositionDraw = ({ rounds, onChange, readOnly }: Props) => {
  // Lấy danh sách tất cả race từ mọi round, để Admin chọn 1 race cụ thể
  const allRaces = rounds.flatMap((round) =>
    round.races.map((race) => ({ round, race }))
  );

  const [selectedRaceId, setSelectedRaceId] = useState<string>(
    allRaces.length > 0 ? allRaces[0].race.id : ''
  );

  const selected = allRaces.find((r) => r.race.id === selectedRaceId);

  const handleRandomizeDraw = () => {
    if (!selected) return;

    // TODO: Logic random thật + đảm bảo UNIQUE(RaceId, PostPosition) nên để
    // Backend xử lý trong 1 transaction, FE chỉ gọi API và hiển thị kết quả trả về,
    // không tự random ở client.
    // Dự kiến: POST /api/admin/races/:raceId/draw → trả về danh sách entries kèm postPosition

    // Đoạn dưới đây CHỈ là giả lập tạm thời để xem giao diện hoạt động (mock-only).
    const shuffledPositions = selected.race.entries
      .map((_, idx) => idx + 1)
      .sort(() => Math.random() - 0.5);

    const updatedEntries = selected.race.entries.map((entry, idx) => ({
      ...entry,
      postPosition: shuffledPositions[idx],
    }));

    const updatedRounds = rounds.map((r) =>
      r.id === selected.round.id
        ? {
            ...r,
            races: r.races.map((race) =>
              race.id === selected.race.id
                ? { ...race, entries: updatedEntries, isPostPositionDrawn: true }
                : race
            ),
          }
        : r
    );

    onChange(updatedRounds);
  };

  if (allRaces.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          Chưa có Race nào được tạo. Vui lòng thêm Round và Race ở tab "Rounds & Races" trước.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.raceSelectWrap}>
        <label className={styles.raceSelectLabel}>Chọn Race</label>
        <select
          className={styles.raceSelect}
          value={selectedRaceId}
          onChange={(e) => setSelectedRaceId(e.target.value)}
        >
          {allRaces.map(({ round, race }) => (
            <option key={race.id} value={race.id}>
              {round.name} — Race #{race.raceNumber}
              {race.scheduledDate ? ` (${race.scheduledDate})` : ''}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          <div className={styles.statusRow}>
            {selected.race.isPostPositionDrawn ? (
              <span className={styles.drawnBadge}>
                <FiCheckCircle size={14} /> Đã bốc thăm
              </span>
            ) : (
              <span className={styles.notDrawnBadge}>Chưa bốc thăm</span>
            )}

{!readOnly && (
  <button
    type="button"
    className={styles.randomizeBtn}
    onClick={handleRandomizeDraw}
    disabled={selected.race.entries.length === 0}
  >
    <FiShuffle size={15} /> Randomize Draw
  </button>
)}
          </div>

          {selected.race.entries.length === 0 ? (
            <div className={styles.emptyState}>
              Chưa có ngựa nào đăng ký và được duyệt cho Race này.
            </div>
          ) : (
            <div className={styles.entriesTable}>
              <div className={styles.entriesHeader}>
                <span>Tên ngựa</span>
                <span>Post Position</span>
              </div>
              {selected.race.entries.map((entry) => (
                <div key={entry.id} className={styles.entryRow}>
                  <span className={styles.horseName}>{entry.horseName}</span>
                  <span
                    className={`${styles.postPosition} ${
                      entry.postPosition ? styles.postPositionAssigned : ''
                    }`}
                  >
                    {entry.postPosition ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TabPostPositionDraw;