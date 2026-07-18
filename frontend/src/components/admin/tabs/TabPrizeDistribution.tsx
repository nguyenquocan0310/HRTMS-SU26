import { useState } from 'react';
import { FiLock, FiUnlock } from 'react-icons/fi';
import type { PrizeRow } from '../TournamentBuilder';
import {
  validatePrizeDistribution,
} from '../tournamentValidation';
import styles from './TabPrizeDistribution.module.scss';

interface Props {
  prizeDistribution: PrizeRow[];
  totalPurse: number;
  onChange: (rows: PrizeRow[]) => void;
  readOnly?: boolean;
  showAllErrors?: boolean;
}

const RANK_LABELS: Record<number, string> = {
  1: 'Top 1',
  2: 'Top 2',
  3: 'Top 3',
  4: 'Top 4',
  5: 'Top 5',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(
    Math.round(value)
  ) + ' VNĐ';

const TabPrizeDistribution = ({
  prizeDistribution,
  totalPurse,
  onChange,
  readOnly,
  showAllErrors = false,
}: Props) => {
  const [locked, setLocked] =
    useState<Set<number>>(new Set());

  const [touched, setTouched] =
    useState<Record<number, boolean>>({});

  const validation =
    validatePrizeDistribution(
      prizeDistribution
    );

  const totalPercentage =
    prizeDistribution.reduce(
      (sum, row) =>
        sum + row.percentage,
      0
    );

  const isTotalValid =
    Math.round(totalPercentage * 100) /
      100 ===
    100;

  const toggleLock = (
    rank: number
  ) => {
    setLocked((previous) => {
      const next = new Set(previous);

      if (next.has(rank)) {
        next.delete(rank);
      } else {
        next.add(rank);
      }

      return next;
    });
  };

  const markTouched = (
    rank: number
  ) => {
    setTouched((previous) => ({
      ...previous,
      [rank]: true,
    }));
  };

  const getFieldError = (
    rank: number
  ): string | undefined => {
    if (
      !showAllErrors &&
      !touched[rank]
    ) {
      return undefined;
    }

    return validation.fieldErrors[
      rank
    ];
  };

  const handleChange = (
    rank: PrizeRow['rank'],
    newValue: number
  ) => {
    markTouched(rank);

    const clamped = Math.max(
      0,
      Math.min(100, newValue)
    );

    const currentRow =
      prizeDistribution.find(
        (row) => row.rank === rank
      );

    if (!currentRow) return;

    const oldValue =
      currentRow.percentage;

    const delta =
      clamped - oldValue;

    const unlockedRows =
      prizeDistribution.filter(
        (row) =>
          row.rank !== rank &&
          !locked.has(row.rank)
      );

    const totalUnlocked =
      unlockedRows.reduce(
        (sum, row) =>
          sum + row.percentage,
        0
      );

    const updated =
      prizeDistribution.map(
        (row) => {
          if (row.rank === rank) {
            return {
              ...row,
              percentage: clamped,
            };
          }

          if (
            locked.has(row.rank)
          ) {
            return row;
          }

          if (
            totalUnlocked === 0
          ) {
            return row;
          }

          const share =
            (row.percentage /
              totalUnlocked) *
            -delta;

          const nextPercentage =
            Math.max(
              0,
              Math.round(
                (row.percentage +
                  share) *
                  10
              ) / 10
            );

          return {
            ...row,
            percentage:
              nextPercentage,
          };
        }
      );

    const newTotal =
      updated.reduce(
        (sum, row) =>
          sum + row.percentage,
        0
      );

    const difference =
      Math.round(
        (100 - newTotal) * 10
      ) / 10;

    if (difference !== 0) {
      const target =
        updated.find(
          (row) =>
            row.rank !== rank &&
            !locked.has(row.rank)
        );

      if (target) {
        target.percentage =
          Math.max(
            0,
            Math.round(
              (target.percentage +
                difference) *
                10
            ) / 10
          );
      }
    }

    onChange(updated);
  };

  return (
    <div
      className={styles.container}
    >
      <div
        className={
          styles.totalPurseCard
        }
      >
        <span
          className={
            styles.totalPurseLabel
          }
        >
          TOTAL PURSE (từ Tab
          Thông số)
        </span>

        <span
          className={
            styles.totalPurseValue
          }
        >
          {formatCurrency(
            totalPurse
          )}
        </span>
      </div>

      <div className={styles.rows}>
        {prizeDistribution.map(
          (row) => {
            const amount =
              totalPurse *
              (row.percentage /
                100);

            const isLocked =
              locked.has(row.rank);

            const fieldError =
              getFieldError(
                row.rank
              );

            return (
              <div
                key={row.rank}
                className={[
                  styles.row,
                  isLocked
                    ? styles.rowLocked
                    : '',
                  fieldError
                    ? styles.rowError
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  className={
                    styles.rankLabel
                  }
                >
                  {
                    RANK_LABELS[
                      row.rank
                    ]
                  }
                </span>

                <input
                  type="range"
                  min={0.01}
                  max={100}
                  step={0.01}
                  value={
                    row.percentage
                  }
                  className={
                    styles.slider
                  }
                  disabled={
                    isLocked ||
                    readOnly
                  }
                  onChange={(
                    event
                  ) =>
                    handleChange(
                      row.rank,
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                />

                <div
                  className={[
                    styles.percentInputWrap,
                    fieldError
                      ? styles.inputError
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="number"
                    min={0.01}
                    max={100}
                    step={0.01}
                    className={
                      styles.percentInput
                    }
                    value={
                      row.percentage
                    }
                    disabled={
                      isLocked ||
                      readOnly
                    }
                    onBlur={() =>
                      markTouched(
                        row.rank
                      )
                    }
                    onChange={(
                      event
                    ) =>
                      handleChange(
                        row.rank,
                        event.target
                          .value === ''
                          ? 0
                          : Number(
                              event
                                .target
                                .value
                            )
                      )
                    }
                  />

                  <span
                    className={
                      styles.percentSign
                    }
                  >
                    %
                  </span>
                </div>

                <span
                  className={
                    styles.amountValue
                  }
                >
                  {formatCurrency(
                    amount
                  )}
                </span>

                <button
                  type="button"
                  className={[
                    styles.lockBtn,
                    isLocked
                      ? styles.lockBtnActive
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    toggleLock(
                      row.rank
                    )
                  }
                  title={
                    isLocked
                      ? 'Bỏ khóa'
                      : 'Khóa giá trị này'
                  }
                  disabled={readOnly}
                >
                  {isLocked ? (
                    <FiLock
                      size={14}
                    />
                  ) : (
                    <FiUnlock
                      size={14}
                    />
                  )}
                </button>

                {fieldError && (
                  <span
                    className={
                      styles.fieldError
                    }
                  >
                    {fieldError}
                  </span>
                )}
              </div>
            );
          }
        )}
      </div>

      <div
        className={[
          styles.totalRow,
          !isTotalValid
            ? styles.totalRowError
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span>Tổng cộng</span>

        <span
          className={
            styles.totalPercentValue
          }
        >
          {Math.round(
            totalPercentage * 100
          ) / 100}
          %
        </span>
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

      <p className={styles.hint}>
        🔒 Khóa hàng nào để giữ
        nguyên giá trị khi điều
        chỉnh các hàng khác. Các
        hàng chưa khóa sẽ tự cân
        bằng để tổng luôn bằng
        100%.
      </p>
    </div>
  );
};

export default TabPrizeDistribution;