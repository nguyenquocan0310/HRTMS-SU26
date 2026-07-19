import { useState } from 'react';
import {
  FiPlus,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';

import type {
  Round,
  Race,
  TrackType,
  TournamentBasicInfo,
} from '../TournamentBuilder';

import {
  validateRounds,
} from '../tournamentValidation';

import styles from './TabRoundsRaces.module.scss';

interface Props {
  rounds: Round[];

  tournamentPurse: number;

  tournamentStartDate: string;

  tournamentEndDate: string;

  onChange: (rounds: Round[]) => void;

  readOnly?: boolean;

  showAllErrors?: boolean;
}

const createEmptyRace = (
  sequenceOrder: number
): Race => ({
  id: `race-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`,

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

const createEmptyRound = (
  roundNumber: number
): Round => ({
  id: `round-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`,

  name: `Round ${roundNumber}`,

  scheduledDate: '',

  races: [],
});

const formatCurrency = (
  value: number
): string =>
  new Intl.NumberFormat('vi-VN').format(
    value
  ) + ' VNĐ';

const TabRoundsRaces = ({
  rounds,

  tournamentPurse,

  tournamentStartDate,

  tournamentEndDate,

  onChange,

  readOnly,

  showAllErrors = false,
}: Props) => {
  const [expandedRounds, setExpandedRounds] =
    useState<Record<string, boolean>>({});

  const [touched, setTouched] =
    useState<Record<string, boolean>>({});

  /*
   * validateRounds cần TournamentBasicInfo.
   *
   * Trong tab này chỉ cần:
   * - startDate
   * - endDate
   * - purseAmount
   *
   * Các field còn lại không được kiểm tra ở đây.
   */
  const validationBasicInfo: TournamentBasicInfo = {
    name: '',

    startDate: tournamentStartDate,

    endDate: tournamentEndDate,

    allowedBreed: '',

    trackType: '',

    raceDistance: '',

    raceCategory: '',

    maxHorses: '',

    minJockeyExperienceYears: '',

    purseAmount: tournamentPurse,

    entryFeeAmount: 0,

    preRaceWeightThresholdKg: 1,

    postRaceWeightDiffThresholdKg: 1,
  };

  const validation = validateRounds(
    rounds,
    validationBasicInfo
  );

  const markTouched = (
    key: string
  ) => {
    setTouched((previous) => ({
      ...previous,

      [key]: true,
    }));
  };

  const getVisibleError = (
    key: string,
    error?: string
  ): string | undefined => {
    if (
      !showAllErrors &&
      !touched[key]
    ) {
      return undefined;
    }

    return error;
  };

  const toggleRound = (
    roundId: string
  ) => {
    setExpandedRounds((previous) => ({
      ...previous,

      [roundId]:
        !(previous[roundId] ?? true),
    }));
  };

  const handleAddRound = () => {
    const newRound = createEmptyRound(
      rounds.length + 1
    );

    onChange([
      ...rounds,
      newRound,
    ]);

    setExpandedRounds((previous) => ({
      ...previous,

      [newRound.id]: true,
    }));
  };

  const handleRemoveRound = (
    roundId: string
  ) => {
    const updatedRounds =
      rounds.filter(
        (round) =>
          round.id !== roundId
      );

    onChange(updatedRounds);
  };

  const handleRoundFieldChange = <
    K extends keyof Round,
  >(
    roundId: string,
    field: K,
    value: Round[K]
  ) => {
    const updatedRounds =
      rounds.map((round) => {
        if (
          round.id !== roundId
        ) {
          return round;
        }

        return {
          ...round,

          [field]: value,
        };
      });

    onChange(updatedRounds);
  };

  const handleAddRace = (
    roundId: string
  ) => {
    const updatedRounds =
      rounds.map((round) => {
        if (
          round.id !== roundId
        ) {
          return round;
        }

        const nextRaceNumber =
          round.races.length + 1;

        const newRace =
          createEmptyRace(
            nextRaceNumber
          );

        return {
          ...round,

          races: [
            ...round.races,

            newRace,
          ],
        };
      });

    onChange(updatedRounds);
  };

  const handleRemoveRace = (
    roundId: string,
    raceId: string
  ) => {
    const updatedRounds =
      rounds.map((round) => {
        if (
          round.id !== roundId
        ) {
          return round;
        }

        return {
          ...round,

          races:
            round.races.filter(
              (race) =>
                race.id !== raceId
            ),
        };
      });

    onChange(updatedRounds);
  };

  const handleRaceFieldChange = <
    K extends keyof Race,
  >(
    roundId: string,
    raceId: string,
    field: K,
    value: Race[K]
  ) => {
    const updatedRounds =
      rounds.map((round) => {
        if (
          round.id !== roundId
        ) {
          return round;
        }

        return {
          ...round,

          races:
            round.races.map(
              (race) => {
                if (
                  race.id !== raceId
                ) {
                  return race;
                }

                return {
                  ...race,

                  [field]: value,
                };
              }
            ),
        };
      });

    onChange(updatedRounds);
  };

  const totalRacePurse =
    rounds.reduce(
      (roundTotal, round) =>
        roundTotal +
        round.races.reduce(
          (
            raceTotal,
            race
          ) =>
            raceTotal +
            (Number(
              race.purseAmount
            ) || 0),
          0
        ),
      0
    );

  return (
    <div
      className={styles.container}
    >
      <div
        className={
          styles.purseSummary
        }
      >
        <div>
          <span
            className={
              styles.purseLabel
            }
          >
            Tournament Purse
          </span>

          <strong>
            {formatCurrency(
              tournamentPurse
            )}
          </strong>
        </div>

        <div>
          <span
            className={
              styles.purseLabel
            }
          >
            Total Race Purse
          </span>

          <strong
            className={
              totalRacePurse >
              tournamentPurse
                ? styles.purseExceeded
                : ''
            }
          >
            {formatCurrency(
              totalRacePurse
            )}
          </strong>
        </div>
      </div>

      {showAllErrors &&
        validation.structureErrors.map(
          (error) => (
            <div
              key={error}
              className={
                styles.errorBanner
              }
            >
              {error}
            </div>
          )
        )}

      <div
        className={
          styles.roundsList
        }
      >
        {rounds.map(
          (
            round,
            roundIndex
          ) => {
            const isExpanded =
              expandedRounds[
                round.id
              ] ?? true;

            const roundErrors =
              validation.fieldErrors[
                round.id
              ] ?? {};

            const roundNameError =
              getVisibleError(
                `${round.id}.name`,
                roundErrors.name
              );

            const roundDateError =
              getVisibleError(
                `${round.id}.scheduledDate`,
                roundErrors.scheduledDate
              );

            return (
              <div
                key={round.id}
                className={
                  styles.roundCard
                }
              >
                <div
                  className={
                    styles.roundHeader
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.roundToggle
                    }
                    onClick={() =>
                      toggleRound(
                        round.id
                      )
                    }
                    aria-label={
                      isExpanded
                        ? 'Thu gọn vòng'
                        : 'Mở rộng vòng'
                    }
                  >
                    {isExpanded ? (
                      <FiChevronUp
                        size={16}
                      />
                    ) : (
                      <FiChevronDown
                        size={16}
                      />
                    )}
                  </button>

                  <div
                    className={
                      styles.roundFieldWrap
                    }
                  >
                    <label
                      className={
                        styles.roundFieldLabel
                      }
                    >
                      Tên Round
                    </label>

                    <input
                      type="text"
                      className={[
                        styles.roundNameInput,

                        roundNameError
                          ? styles.inputError
                          : '',
                      ]
                        .filter(
                          Boolean
                        )
                        .join(' ')}
                      value={
                        round.name
                      }
                      placeholder={`Round ${
                        roundIndex +
                        1
                      }`}
                      maxLength={
                        101
                      }
                      disabled={
                        readOnly
                      }
                      onBlur={() =>
                        markTouched(
                          `${round.id}.name`
                        )
                      }
                      onChange={(
                        event
                      ) =>
                        handleRoundFieldChange(
                          round.id,

                          'name',

                          event
                            .target
                            .value
                        )
                      }
                    />

                    {roundNameError && (
                      <span
                        className={
                          styles.raceErrorText
                        }
                      >
                        {
                          roundNameError
                        }
                      </span>
                    )}
                  </div>

                  <div
                    className={
                      styles.roundFieldWrap
                    }
                  >
                    <label
                      className={
                        styles.roundFieldLabel
                      }
                    >
                      Ngày Round
                    </label>

                    <input
                      type="date"
                      className={[
                        styles.roundDateInput,

                        roundDateError
                          ? styles.inputError
                          : '',
                      ]
                        .filter(
                          Boolean
                        )
                        .join(' ')}
                      value={
                        round.scheduledDate
                      }
                      min={
                        tournamentStartDate ||
                        undefined
                      }
                      max={
                        tournamentEndDate ||
                        undefined
                      }
                      disabled={
                        readOnly
                      }
                      onBlur={() =>
                        markTouched(
                          `${round.id}.scheduledDate`
                        )
                      }
                      onChange={(
                        event
                      ) =>
                        handleRoundFieldChange(
                          round.id,

                          'scheduledDate',

                          event
                            .target
                            .value
                        )
                      }
                    />

                    {roundDateError && (
                      <span
                        className={
                          styles.raceErrorText
                        }
                      >
                        {
                          roundDateError
                        }
                      </span>
                    )}
                  </div>

                  <span
                    className={
                      styles.raceCountBadge
                    }
                  >
                    {
                      round.races
                        .length
                    }{' '}
                    race
                  </span>

                  {!readOnly && (
                    <button
                      type="button"
                      className={
                        styles.removeRoundBtn
                      }
                      onClick={() =>
                        handleRemoveRound(
                          round.id
                        )
                      }
                      aria-label="Xóa Round"
                      title="Xóa Round"
                    >
                      <FiTrash2
                        size={15}
                      />
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div
                    className={
                      styles.racesList
                    }
                  >
                    {round.races.map(
                      (
                        race
                      ) => {
                        const raceErrors =
                          roundErrors
                            .races?.[
                            race.id
                          ] ?? {};

                        const isFrozen =
                          race.isPostPositionDrawn;

                        const fieldKey =
                          (
                            field: string
                          ) =>
                            `${round.id}.${race.id}.${field}`;

                        const scheduledDateError =
                          getVisibleError(
                            fieldKey(
                              'scheduledDate'
                            ),

                            raceErrors.scheduledDate
                          );

                        const scheduledTimeError =
                          getVisibleError(
                            fieldKey(
                              'scheduledTime'
                            ),

                            raceErrors.scheduledTime
                          );

                        const purseAmountError =
                          getVisibleError(
                            fieldKey(
                              'purseAmount'
                            ),

                            raceErrors.purseAmount
                          );

                        const distanceOverrideError =
                          getVisibleError(
                            fieldKey(
                              'raceDistanceOverride'
                            ),

                            raceErrors.raceDistanceOverride
                          );

                        return (
                          <div
                            key={
                              race.id
                            }
                            className={
                              styles.raceRow
                            }
                          >
                            <div
                              className={
                                styles.raceRowHeader
                              }
                            >
                              <span
                                className={
                                  styles.raceNumberBadge
                                }
                              >
                                Race #
                                {
                                  race.raceNumber
                                }
                              </span>

                              {isFrozen && (
                                <span
                                  className={
                                    styles.frozenBadge
                                  }
                                >
                                  🔒 Đã
                                  bốc
                                  thăm
                                </span>
                              )}

                              {!readOnly && (
                                <button
                                  type="button"
                                  className={
                                    styles.removeRaceBtn
                                  }
                                  onClick={() =>
                                    handleRemoveRace(
                                      round.id,

                                      race.id
                                    )
                                  }
                                  aria-label="Xóa Race"
                                  title="Xóa Race"
                                >
                                  <FiTrash2
                                    size={
                                      13
                                    }
                                  />
                                </button>
                              )}
                            </div>

                            <div
                              className={
                                styles.raceFields
                              }
                            >
                              {/* Race Number */}
                              <div
                                className={
                                  styles.raceField
                                }
                              >
                                <label>
                                  Race
                                  Number
                                </label>

                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={
                                    race.raceNumber
                                  }
                                  disabled={
                                    isFrozen ||
                                    readOnly
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleRaceFieldChange(
                                      round.id,

                                      race.id,

                                      'raceNumber',

                                      Number(
                                        event
                                          .target
                                          .value
                                      )
                                    )
                                  }
                                />
                              </div>

                              {/* Race Date */}
                              <div
                                className={
                                  styles.raceField
                                }
                              >
                                <label>
                                  Ngày đua
                                </label>

                                <input
                                  type="date"
                                  className={
                                    scheduledDateError
                                      ? styles.inputError
                                      : ''
                                  }
                                  value={
                                    race.scheduledDate
                                  }
                                  min={
                                    round.scheduledDate ||
                                    tournamentStartDate ||
                                    undefined
                                  }
                                  max={
                                    tournamentEndDate ||
                                    undefined
                                  }
                                  disabled={
                                    isFrozen ||
                                    readOnly
                                  }
                                  onBlur={() =>
                                    markTouched(
                                      fieldKey(
                                        'scheduledDate'
                                      )
                                    )
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleRaceFieldChange(
                                      round.id,

                                      race.id,

                                      'scheduledDate',

                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />

                                {scheduledDateError && (
                                  <span
                                    className={
                                      styles.raceErrorText
                                    }
                                  >
                                    {
                                      scheduledDateError
                                    }
                                  </span>
                                )}
                              </div>

                              {/* Race Time */}
                              <div
                                className={
                                  styles.raceField
                                }
                              >
                                <label>
                                  Giờ đua
                                </label>

                                <input
                                  type="time"
                                  className={
                                    scheduledTimeError
                                      ? styles.inputError
                                      : ''
                                  }
                                  value={
                                    race.scheduledTime
                                  }
                                  disabled={
                                    isFrozen ||
                                    readOnly
                                  }
                                  onBlur={() =>
                                    markTouched(
                                      fieldKey(
                                        'scheduledTime'
                                      )
                                    )
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleRaceFieldChange(
                                      round.id,

                                      race.id,

                                      'scheduledTime',

                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />

                                {scheduledTimeError && (
                                  <span
                                    className={
                                      styles.raceErrorText
                                    }
                                  >
                                    {
                                      scheduledTimeError
                                    }
                                  </span>
                                )}
                              </div>

                              {/* Purse Amount */}
                              <div
                                className={
                                  styles.raceField
                                }
                              >
                                <label>
                                  Purse
                                  Amount
                                </label>

                                <input
                                  type="number"
                                  min={0}
                                  className={
                                    purseAmountError
                                      ? styles.inputError
                                      : ''
                                  }
                                  value={
                                    race.purseAmount
                                  }
                                  disabled={
                                    readOnly
                                  }
                                  onBlur={() =>
                                    markTouched(
                                      fieldKey(
                                        'purseAmount'
                                      )
                                    )
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleRaceFieldChange(
                                      round.id,

                                      race.id,

                                      'purseAmount',

                                      event
                                        .target
                                        .value
                                        ? Number(
                                            event
                                              .target
                                              .value
                                          )
                                        : ''
                                    )
                                  }
                                />

                                {purseAmountError && (
                                  <span
                                    className={
                                      styles.raceErrorText
                                    }
                                  >
                                    {
                                      purseAmountError
                                    }
                                  </span>
                                )}
                              </div>

                              {/* Race Distance Override */}
                              <div
                                className={
                                  styles.raceField
                                }
                              >
                                <label>
                                  Distance
                                  Override
                                </label>

                                <input
                                  type="number"
                                  placeholder="Tùy chọn"
                                  className={
                                    distanceOverrideError
                                      ? styles.inputError
                                      : ''
                                  }
                                  value={
                                    race.raceDistanceOverride
                                  }
                                  disabled={
                                    isFrozen ||
                                    readOnly
                                  }
                                  onBlur={() =>
                                    markTouched(
                                      fieldKey(
                                        'raceDistanceOverride'
                                      )
                                    )
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleRaceFieldChange(
                                      round.id,

                                      race.id,

                                      'raceDistanceOverride',

                                      event
                                        .target
                                        .value
                                        ? Number(
                                            event
                                              .target
                                              .value
                                          )
                                        : ''
                                    )
                                  }
                                />

                                {distanceOverrideError && (
                                  <span
                                    className={
                                      styles.raceErrorText
                                    }
                                  >
                                    {
                                      distanceOverrideError
                                    }
                                  </span>
                                )}
                              </div>

                              {/* Track Type Override */}
                              <div
                                className={
                                  styles.raceField
                                }
                              >
                                <label>
                                  Track Type
                                  Override
                                </label>

                                <select
                                  value={
                                    race.trackTypeOverride
                                  }
                                  disabled={
                                    isFrozen ||
                                    readOnly
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleRaceFieldChange(
                                      round.id,

                                      race.id,

                                      'trackTypeOverride',

                                      event
                                        .target
                                        .value as TrackType
                                    )
                                  }
                                >
                                  <option value="">
                                    --
                                    Mặc
                                    định
                                    --
                                  </option>

                                  <option value="Turf">
                                    Turf
                                  </option>

                                  <option value="Dirt">
                                    Dirt
                                  </option>

                                  <option value="Synthetic">
                                    Synthetic
                                  </option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}

                    {!readOnly && (
                      <button
                        type="button"
                        className={
                          styles.addRaceBtn
                        }
                        onClick={() =>
                          handleAddRace(
                            round.id
                          )
                        }
                      >
                        <FiPlus
                          size={14}
                        />

                        Thêm Race
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>

      {!readOnly && (
        <button
          type="button"
          className={
            styles.addRoundBtn
          }
          onClick={
            handleAddRound
          }
        >
          <FiPlus size={16} />

          Thêm Round
        </button>
      )}
    </div>
  );
};

export default TabRoundsRaces;