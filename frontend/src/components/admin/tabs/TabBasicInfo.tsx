import { useState } from 'react';
import type {
  TournamentBasicInfo,
  AllowedBreed,
  TrackType,
  RaceCategory,
} from '../TournamentBuilder';
import {
  validateBasicInfo,
  type BasicFieldErrors,
} from '../tournamentValidation';
import styles from './TabBasicInfo.module.scss';

interface Props {
  data: TournamentBasicInfo;
  onChange: (
    data: TournamentBasicInfo
  ) => void;
  readOnly?: boolean;
  showAllErrors?: boolean;
  isCreateMode: boolean;
}

const RACE_DISTANCES = [
  1600,
  1800,
  2000,
];

const formatVND = (
  value: number | ''
): string => {
  if (value === '') return '';

  return Number(value).toLocaleString(
    'vi-VN'
  );
};

const parseVND = (
  value: string
): number | '' => {
  const cleaned = value
    .replace(/\./g, '')
    .replace(/,/g, '');

  if (!cleaned) return '';

  const numberValue = Number(cleaned);

  return Number.isNaN(numberValue)
    ? ''
    : numberValue;
};

const TabBasicInfo = ({
  data,
  onChange,
  readOnly,
  showAllErrors = false,
  isCreateMode,
}: Props) => {
  const [touched, setTouched] =
    useState<
      Partial<
        Record<
          keyof TournamentBasicInfo,
          boolean
        >
      >
    >({});

  const errors: BasicFieldErrors =
    validateBasicInfo(
      data,
      isCreateMode
    );

  const update = <
    K extends keyof TournamentBasicInfo,
  >(
    field: K,
    value: TournamentBasicInfo[K]
  ) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const markTouched = (
    field: keyof TournamentBasicInfo
  ) => {
    setTouched((previous) => ({
      ...previous,
      [field]: true,
    }));
  };

  const getVisibleError = (
    field: keyof TournamentBasicInfo
  ): string | undefined => {
    if (
      !showAllErrors &&
      !touched[field]
    ) {
      return undefined;
    }

    return errors[field];
  };

  const getInputClass = (
    field: keyof TournamentBasicInfo
  ): string => {
    const error =
      getVisibleError(field);

    return [
      styles.input,
      error ? styles.inputError : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {/* Tournament Name */}
        <div
          className={`${styles.field} ${styles.fieldFull}`}
        >
          <label className={styles.label}>
            Tên giải đấu
          </label>

          <input
            type="text"
            className={getInputClass(
              'name'
            )}
            placeholder="Ví dụ: Royal Stakes – Ascot Cup 2026"
            value={data.name}
            disabled={readOnly}
            onBlur={() =>
              markTouched('name')
            }
            onChange={(event) =>
              update(
                'name',
                event.target.value
              )
            }
          />

          {getVisibleError('name') && (
            <span
              className={styles.errorText}
            >
              {getVisibleError('name')}
            </span>
          )}
        </div>

        {/* Start Date */}
        <div className={styles.field}>
          <label className={styles.label}>
            Ngày bắt đầu
          </label>

          <input
            type="date"
            className={getInputClass(
              'startDate'
            )}
            value={data.startDate}
            disabled={readOnly}
            onBlur={() =>
              markTouched('startDate')
            }
            onChange={(event) =>
              update(
                'startDate',
                event.target.value
              )
            }
          />

          {getVisibleError(
            'startDate'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'startDate'
              )}
            </span>
          )}
        </div>

        {/* End Date */}
        <div className={styles.field}>
          <label className={styles.label}>
            Ngày kết thúc
          </label>

          <input
            type="date"
            className={getInputClass(
              'endDate'
            )}
            value={data.endDate}
            disabled={readOnly}
            onBlur={() =>
              markTouched('endDate')
            }
            onChange={(event) =>
              update(
                'endDate',
                event.target.value
              )
            }
          />

          {getVisibleError(
            'endDate'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'endDate'
              )}
            </span>
          )}
        </div>

        {/* Allowed Breed */}
        <div className={styles.field}>
          <label className={styles.label}>
            Allowed Breed
          </label>

          <select
            className={getInputClass(
              'allowedBreed'
            )}
            value={data.allowedBreed}
            disabled={readOnly}
            onBlur={() =>
              markTouched(
                'allowedBreed'
              )
            }
            onChange={(event) =>
              update(
                'allowedBreed',
                event.target
                  .value as AllowedBreed
              )
            }
          >
            <option value="">
              -- Chọn giống ngựa --
            </option>

            <option value="Thoroughbred">
              Thoroughbred
            </option>

            <option value="Arabian">
              Arabian
            </option>

            <option value="Quarter Horse">
              Quarter Horse
            </option>

            <option value="Mixed">
              Mixed
            </option>
          </select>

          {getVisibleError(
            'allowedBreed'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'allowedBreed'
              )}
            </span>
          )}
        </div>

        {/* Track Type */}
        <div className={styles.field}>
          <label className={styles.label}>
            Track Type
          </label>

          <select
            className={getInputClass(
              'trackType'
            )}
            value={data.trackType}
            disabled={readOnly}
            onBlur={() =>
              markTouched('trackType')
            }
            onChange={(event) =>
              update(
                'trackType',
                event.target
                  .value as TrackType
              )
            }
          >
            <option value="">
              -- Chọn loại đường đua --
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

          {getVisibleError(
            'trackType'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'trackType'
              )}
            </span>
          )}
        </div>

        {/* Race Distance */}
        <div className={styles.field}>
          <label className={styles.label}>
            Race Distance (mét)
          </label>

          <input
            type="number"
            className={getInputClass(
              'raceDistance'
            )}
            placeholder="Ví dụ: 1600"
            list="race-distance-options"
            value={data.raceDistance}
            disabled={readOnly}
            onBlur={() =>
              markTouched(
                'raceDistance'
              )
            }
            onChange={(event) =>
              update(
                'raceDistance',
                event.target.value
                  ? Number(
                      event.target.value
                    )
                  : ''
              )
            }
          />

          <datalist id="race-distance-options">
            {RACE_DISTANCES.map(
              (distance) => (
                <option
                  key={distance}
                  value={distance}
                >
                  {distance.toLocaleString(
                    'vi-VN'
                  )}{' '}
                  m
                </option>
              )
            )}
          </datalist>

          <div
            className={styles.suggestions}
          >
            {RACE_DISTANCES.map(
              (distance) => (
                <button
                  key={distance}
                  type="button"
                  className={[
                    styles.suggestionBtn,
                    data.raceDistance ===
                    distance
                      ? styles.suggestionBtnActive
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={readOnly}
                  onClick={() => {
                    update(
                      'raceDistance',
                      distance
                    );

                    markTouched(
                      'raceDistance'
                    );
                  }}
                >
                  {distance.toLocaleString(
                    'vi-VN'
                  )}
                </button>
              )
            )}
          </div>

          {getVisibleError(
            'raceDistance'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'raceDistance'
              )}
            </span>
          )}
        </div>

        {/* Race Category */}
        <div className={styles.field}>
          <label className={styles.label}>
            Race Category
          </label>

          <select
            className={getInputClass(
              'raceCategory'
            )}
            value={data.raceCategory}
            disabled={readOnly}
            onBlur={() =>
              markTouched(
                'raceCategory'
              )
            }
            onChange={(event) =>
              update(
                'raceCategory',
                event.target
                  .value as RaceCategory
              )
            }
          >
            <option value="">
              -- Chọn hạng đua --
            </option>

            <option value="Open">
              Open
            </option>

            <option value="Classic">
              Classic
            </option>

            <option value="Maiden">
              Maiden
            </option>
          </select>

          {getVisibleError(
            'raceCategory'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'raceCategory'
              )}
            </span>
          )}
        </div>

        {/* Max Horses */}
        <div className={styles.field}>
          <label className={styles.label}>
            Max Horses
          </label>

          <input
            type="number"
            className={getInputClass(
              'maxHorses'
            )}
            placeholder="Ví dụ: 12"
            value={data.maxHorses}
            disabled={readOnly}
            onBlur={() =>
              markTouched('maxHorses')
            }
            onChange={(event) =>
              update(
                'maxHorses',
                event.target.value
                  ? Number(
                      event.target.value
                    )
                  : ''
              )
            }
          />

          {getVisibleError(
            'maxHorses'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'maxHorses'
              )}
            </span>
          )}
        </div>

        {/* Jockey Experience */}
        <div className={styles.field}>
          <label className={styles.label}>
            Min Jockey Experience
            (năm)
          </label>

          <input
            type="number"
            className={getInputClass(
              'minJockeyExperienceYears'
            )}
            placeholder="Ví dụ: 2"
            value={
              data.minJockeyExperienceYears
            }
            disabled={readOnly}
            onBlur={() =>
              markTouched(
                'minJockeyExperienceYears'
              )
            }
            onChange={(event) =>
              update(
                'minJockeyExperienceYears',
                event.target.value
                  ? Number(
                      event.target.value
                    )
                  : ''
              )
            }
          />

          {getVisibleError(
            'minJockeyExperienceYears'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'minJockeyExperienceYears'
              )}
            </span>
          )}
        </div>

        {/* Purse Amount */}
        <div className={styles.field}>
          <label className={styles.label}>
            Purse Amount
          </label>

          <input
            type="text"
            className={getInputClass(
              'purseAmount'
            )}
            placeholder="Ví dụ: 500.000.000"
            value={formatVND(
              data.purseAmount
            )}
            disabled={readOnly}
            onBlur={() =>
              markTouched(
                'purseAmount'
              )
            }
            onChange={(event) =>
              update(
                'purseAmount',
                parseVND(
                  event.target.value
                )
              )
            }
          />

          {getVisibleError(
            'purseAmount'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'purseAmount'
              )}
            </span>
          )}
        </div>

        {/* Entry Fee */}
        <div className={styles.field}>
          <label className={styles.label}>
            Entry Fee Amount
          </label>

          <input
            type="text"
            className={getInputClass(
              'entryFeeAmount'
            )}
            placeholder="Ví dụ: 500.000"
            value={
              data.entryFeeAmount === 0
                ? ''
                : formatVND(
                    data.entryFeeAmount
                  )
            }
            disabled={readOnly}
            onBlur={() =>
              markTouched(
                'entryFeeAmount'
              )
            }
            onChange={(event) => {
              const parsedValue =
                parseVND(
                  event.target.value
                );

              update(
                'entryFeeAmount',
                parsedValue === ''
                  ? 0
                  : parsedValue
              );
            }}
          />

          <span
            className={styles.hintText}
          >
            VND — nhập 0 hoặc để trống
            nếu miễn phí.
          </span>

          {getVisibleError(
            'entryFeeAmount'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'entryFeeAmount'
              )}
            </span>
          )}
        </div>

        {/* Pre-race Weight */}
        <div className={styles.field}>
          <label className={styles.label}>
            Pre-Race Weight Threshold
            (kg)
          </label>

          <input
            type="number"
            step="0.1"
            className={getInputClass(
              'preRaceWeightThresholdKg'
            )}
            value={
              data.preRaceWeightThresholdKg
            }
            disabled={readOnly}
            onBlur={() =>
              markTouched(
                'preRaceWeightThresholdKg'
              )
            }
            onChange={(event) =>
              update(
                'preRaceWeightThresholdKg',
                Number(
                  event.target.value
                )
              )
            }
          />

          {getVisibleError(
            'preRaceWeightThresholdKg'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'preRaceWeightThresholdKg'
              )}
            </span>
          )}
        </div>

        {/* Post-race Weight */}
        <div className={styles.field}>
          <label className={styles.label}>
            Post-Race Weight Diff
            Threshold (kg)
          </label>

          <input
            type="number"
            step="0.1"
            className={getInputClass(
              'postRaceWeightDiffThresholdKg'
            )}
            value={
              data.postRaceWeightDiffThresholdKg
            }
            disabled={readOnly}
            onBlur={() =>
              markTouched(
                'postRaceWeightDiffThresholdKg'
              )
            }
            onChange={(event) =>
              update(
                'postRaceWeightDiffThresholdKg',
                Number(
                  event.target.value
                )
              )
            }
          />

          {getVisibleError(
            'postRaceWeightDiffThresholdKg'
          ) && (
            <span
              className={styles.errorText}
            >
              {getVisibleError(
                'postRaceWeightDiffThresholdKg'
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TabBasicInfo;