import { useState } from 'react';
import { FiPlus, FiTrash2, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import type { Round, Race, TrackType } from '../TournamentBuilder';
import styles from './TabRoundsRaces.module.scss';

interface Props {
  rounds: Round[];
  tournamentPurse: number;
  tournamentStartDate: string;
  tournamentEndDate: string;
  onChange: (rounds: Round[]) => void;
  readOnly?: boolean;
}

const createEmptyRace = (sequenceOrder: number): Race => ({
  id: `race-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  sequenceOrder,
  scheduledDate: '',
  raceNumber: sequenceOrder,
  scheduledTime: '',
  purseAmount: '',
  raceDistanceOverride: '',
  trackTypeOverride: '',
  isPostPositionDrawn: false,
  entries: [],
});

const createEmptyRound = (index: number): Round => ({
  id: `round-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: `Round ${index}`,
  scheduledDate: '',
  races: [],
});

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
};

const TabRoundsRaces = ({ rounds, tournamentPurse, tournamentStartDate, tournamentEndDate, onChange, readOnly }: Props) => {
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});

  const toggleRound = (id: string) => {
    setExpandedRounds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalRacePurse = rounds.reduce(
    (sum, round) => sum + round.races.reduce((rSum, race) => rSum + (Number(race.purseAmount) || 0), 0),
    0
  );
  const purseExceeded = tournamentPurse > 0 && totalRacePurse > tournamentPurse;

  // ─── Round handlers ─────────────────────────────────────────────────────
  const handleAddRound = () => {
    const newRound = createEmptyRound(rounds.length + 1);
    onChange([...rounds, newRound]);
    setExpandedRounds((prev) => ({ ...prev, [newRound.id]: true }));
  };

  const handleRemoveRound = (roundId: string) => {
    onChange(rounds.filter((r) => r.id !== roundId));
  };

  const handleRoundFieldChange = (roundId: string, field: keyof Round, value: string) => {
    onChange(
      rounds.map((r) => (r.id === roundId ? { ...r, [field]: value } : r))
    );
  };

  // ─── Race handlers ──────────────────────────────────────────────────────
  const handleAddRace = (roundId: string) => {
    onChange(
      rounds.map((r) =>
        r.id === roundId
          ? { ...r, races: [...r.races, createEmptyRace(r.races.length + 1)] }
          : r
      )
    );
  };

  const handleRemoveRace = (roundId: string, raceId: string) => {
    onChange(
      rounds.map((r) =>
        r.id === roundId ? { ...r, races: r.races.filter((race) => race.id !== raceId) } : r
      )
    );
  };

  const handleRaceFieldChange = <K extends keyof Race>(
    roundId: string,
    raceId: string,
    field: K,
    value: Race[K]
  ) => {
    onChange(
      rounds.map((r) =>
        r.id === roundId
          ? {
              ...r,
              races: r.races.map((race) =>
                race.id === raceId ? { ...race, [field]: value } : race
              ),
            }
          : r
      )
    );
  };

  // ─── Validate 1 race cụ thể ─────────────────────────────────────────────
  // Ngày đua (scheduledDate, yyyy-MM-dd) và Giờ đua (scheduledTime, HH:mm) là
  // 2 trường tách biệt → validate theo NGÀY, không so giờ với ngày như trước.
  const validateRace = (round: Round, race: Race): string | null => {
    if (!race.scheduledDate) return null;

    if (tournamentStartDate && race.scheduledDate < tournamentStartDate) {
      return 'Ngày đua không được sớm hơn ngày bắt đầu giải.';
    }
    if (tournamentEndDate && race.scheduledDate > tournamentEndDate) {
      return 'Ngày đua không được muộn hơn ngày kết thúc giải.';
    }
    if (round.scheduledDate && race.scheduledDate < round.scheduledDate) {
      return 'Ngày đua không được sớm hơn ngày của Round.';
    }
    return null;
  };

  return (
    <div className={styles.container}>
      {purseExceeded && (
        <div className={styles.errorBanner}>
          Tổng Purse của tất cả Race ({formatCurrency(totalRacePurse)}) đang VƯỢT quá Purse toàn giải (
          {formatCurrency(tournamentPurse)}).
        </div>
      )}

      <div className={styles.roundsList}>
        {rounds.map((round) => {
          const isExpanded = expandedRounds[round.id] ?? true;

          return (
            <div key={round.id} className={styles.roundCard}>
              <div className={styles.roundHeader}>
                <button
                  type="button"
                  className={styles.roundToggle}
                  onClick={() => toggleRound(round.id)}
                >
                  {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                </button>

                <input
                  type="text"
                  className={styles.roundNameInput}
                  value={round.name}
                  disabled={readOnly}
                  onChange={(e) => handleRoundFieldChange(round.id, 'name', e.target.value)}
                />

                <input
                  type="date"
                  className={styles.roundDateInput}
                  value={round.scheduledDate}
                  disabled={readOnly}
                  onChange={(e) => handleRoundFieldChange(round.id, 'scheduledDate', e.target.value)}
                />

                <span className={styles.raceCountBadge}>{round.races.length} race</span>

{!readOnly && (
  <button
    type="button"
    className={styles.removeRoundBtn}
    onClick={() => handleRemoveRound(round.id)}
    aria-label="Xóa Round"
  >
    <FiTrash2 size={15} />
  </button>
)}
              </div>

              {isExpanded && (
                <div className={styles.racesList}>
                  {round.races.map((race) => {
                    const timeError = validateRace(round, race);
                    const isFrozen = race.isPostPositionDrawn;

                    return (
                      <div key={race.id} className={styles.raceRow}>
                        <div className={styles.raceRowHeader}>
                          <span className={styles.raceNumberBadge}>Race #{race.raceNumber}</span>
                          {isFrozen && (
                            <span className={styles.frozenBadge} title="Đã đóng băng sau khi bốc thăm — muốn đổi phải hủy race">
                              🔒 Đã bốc thăm
                            </span>
                          )}
{!readOnly && (
  <button
    type="button"
    className={styles.removeRaceBtn}
    onClick={() => handleRemoveRace(round.id, race.id)}
  >
    <FiTrash2 size={13} />
  </button>
)}
                        </div>

                        <div className={styles.raceFields}>
                          <div className={styles.raceField}>
                            <label>Ngày đua</label>
                            <input
                              type="date"
                              value={race.scheduledDate}
                              disabled={isFrozen || readOnly}
                              onChange={(e) =>
                                handleRaceFieldChange(round.id, race.id, 'scheduledDate', e.target.value)
                              }
                            />
                          </div>

                          <div className={styles.raceField}>
                            <label>Giờ đua</label>
                            <input
                              type="time"
                              value={race.scheduledTime}
                              disabled={isFrozen || readOnly}
                              title={isFrozen ? 'Đã đóng băng sau khi bốc thăm — muốn đổi phải hủy race' : undefined}
                              onChange={(e) =>
                                handleRaceFieldChange(round.id, race.id, 'scheduledTime', e.target.value)
                              }
                            />
                          </div>

                          <div className={styles.raceField}>
                            <label>Purse Amount (race này)</label>
                            <input
                              type="number"
                              value={race.purseAmount}
                              disabled={readOnly}
                              onChange={(e) =>
                                handleRaceFieldChange(
                                  round.id,
                                  race.id,
                                  'purseAmount',
                                  e.target.value ? Number(e.target.value) : ''
                                )
                              }
                            />
                          </div>

                          <div className={styles.raceField}>
                            <label>Distance Override (tùy chọn)</label>
                            <input
                              type="number"
                              placeholder="Mét"
                              value={race.raceDistanceOverride}
                              disabled={isFrozen || readOnly}
                              title={isFrozen ? 'Đã đóng băng sau khi bốc thăm — muốn đổi phải hủy race' : undefined}
                              onChange={(e) =>
                                handleRaceFieldChange(
                                  round.id,
                                  race.id,
                                  'raceDistanceOverride',
                                  e.target.value ? Number(e.target.value) : ''
                                )
                              }
                            />
                          </div>

                          <div className={styles.raceField}>
                            <label>Track Type Override (tùy chọn)</label>
                            <select
                              value={race.trackTypeOverride}
                              disabled={isFrozen || readOnly}
                              title={isFrozen ? 'Đã đóng băng sau khi bốc thăm — muốn đổi phải hủy race' : undefined}
                              onChange={(e) =>
                                handleRaceFieldChange(
                                  round.id,
                                  race.id,
                                  'trackTypeOverride',
                                  e.target.value as TrackType
                                )
                              }
                            >
                              <option value="">-- Mặc định --</option>
                              <option value="Turf">Turf</option>
                              <option value="Dirt">Dirt</option>
                              <option value="Synthetic">Synthetic</option>
                            </select>
                          </div>
                        </div>

                        {timeError && <span className={styles.raceErrorText}>{timeError}</span>}
                      </div>
                    );
                  })}

{!readOnly && (
  <button type="button" className={styles.addRaceBtn} onClick={() => handleAddRace(round.id)}>
    <FiPlus size={14} /> Thêm Race
  </button>
)}
                </div>
              )}
            </div>
          );
        })}
      </div>

{!readOnly && (
  <button type="button" className={styles.addRoundBtn} onClick={handleAddRound}>
    <FiPlus size={16} /> Thêm Round
  </button>
)}
    </div>
  );
};

export default TabRoundsRaces;