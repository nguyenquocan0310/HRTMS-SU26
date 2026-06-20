import type { PrizeRow } from '../TournamentBuilder';
import styles from './TabPrizeDistribution.module.scss';

interface Props {
  prizeDistribution: PrizeRow[];
  totalPurse: number;
  onChange: (rows: PrizeRow[]) => void;
}

const RANK_LABELS: Record<number, string> = {
  1: 'Top 1',
  2: 'Top 2',
  3: 'Top 3',
  4: 'Top 4',
  5: 'Top 5',
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
};

const TabPrizeDistribution = ({ prizeDistribution, totalPurse, onChange }: Props) => {
  const totalPercentage = prizeDistribution.reduce((sum, row) => sum + row.percentage, 0);
  const isTotalValid = totalPercentage === 100;

  const handlePercentageChange = (rank: PrizeRow['rank'], value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    const updated = prizeDistribution.map((row) =>
      row.rank === rank ? { ...row, percentage: clamped } : row
    );
    onChange(updated);
  };

  return (
    <div className={styles.container}>
      <div className={styles.totalPurseCard}>
        <span className={styles.totalPurseLabel}>TOTAL PURSE (từ Tab Thông số)</span>
        <span className={styles.totalPurseValue}>{formatCurrency(totalPurse)}</span>
      </div>

      <div className={styles.rows}>
        {prizeDistribution.map((row) => {
          const amount = totalPurse * (row.percentage / 100);
          return (
            <div key={row.rank} className={styles.row}>
              <span className={styles.rankLabel}>{RANK_LABELS[row.rank]}</span>

              <input
                type="range"
                min={0}
                max={100}
                value={row.percentage}
                className={styles.slider}
                onChange={(e) => handlePercentageChange(row.rank, Number(e.target.value))}
              />

              <div className={styles.percentInputWrap}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={styles.percentInput}
                  value={row.percentage}
                  onChange={(e) => handlePercentageChange(row.rank, Number(e.target.value) || 0)}
                />
                <span className={styles.percentSign}>%</span>
              </div>

              <span className={styles.amountValue}>{formatCurrency(amount)}</span>
            </div>
          );
        })}
      </div>

      <div className={`${styles.totalRow} ${!isTotalValid ? styles.totalRowError : ''}`}>
        <span>Tổng cộng</span>
        <span className={styles.totalPercentValue}>{totalPercentage}%</span>
      </div>

      {!isTotalValid && (
        <div className={styles.errorBanner}>
          Tổng tỷ lệ phải bằng đúng 100% trước khi lưu hoặc publish.
          {totalPercentage > 100
            ? ` Hiện đang vượt ${totalPercentage - 100}%.`
            : ` Còn thiếu ${100 - totalPercentage}%.`}
        </div>
      )}
    </div>
  );
};

export default TabPrizeDistribution;