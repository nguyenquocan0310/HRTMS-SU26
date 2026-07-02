import { useState } from 'react';
import { FiLock, FiUnlock } from 'react-icons/fi';
import type { PrizeRow } from '../TournamentBuilder';
import styles from './TabPrizeDistribution.module.scss';

interface Props {
  prizeDistribution: PrizeRow[];
  totalPurse: number;
  onChange: (rows: PrizeRow[]) => void;
}

const RANK_LABELS: Record<number, string> = { 1:'Top 1', 2:'Top 2', 3:'Top 3', 4:'Top 4', 5:'Top 5' };

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' VNĐ';

const TabPrizeDistribution = ({ prizeDistribution, totalPurse, onChange }: Props) => {
  // locked: set of ranks bị khóa
  const [locked, setLocked] = useState<Set<number>>(new Set());

  const totalPercentage = prizeDistribution.reduce((sum, r) => sum + r.percentage, 0);
  const isTotalValid = totalPercentage === 100;

  const toggleLock = (rank: number) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });
  };

  const handleChange = (rank: PrizeRow['rank'], newValue: number) => {
    const clamped = Math.max(0, Math.min(100, newValue));

    // Tính delta
    const oldValue = prizeDistribution.find((r) => r.rank === rank)!.percentage;
    const delta = clamped - oldValue;

    // Các hàng không bị khóa và không phải hàng đang thay đổi
    const unlocked = prizeDistribution.filter((r) => r.rank !== rank && !locked.has(r.rank));
    const totalUnlocked = unlocked.reduce((s, r) => s + r.percentage, 0);

    const updated = prizeDistribution.map((r) => {
      if (r.rank === rank) return { ...r, percentage: clamped };
      if (locked.has(r.rank)) return r; // khóa → không đổi
      // Phân bổ delta ngược lại theo tỉ lệ
      if (totalUnlocked === 0) return r;
      const share = (r.percentage / totalUnlocked) * (-delta);
      const newPct = Math.max(0, Math.round((r.percentage + share) * 10) / 10);
      return { ...r, percentage: newPct };
    });

    // Điều chỉnh rounding để tổng = 100
    const newTotal = updated.reduce((s, r) => s + r.percentage, 0);
    const diff = Math.round((100 - newTotal) * 10) / 10;
    if (diff !== 0) {
      // Thêm diff vào hàng unlocked đầu tiên (không phải hàng đang thay đổi)
      const target = updated.find((r) => r.rank !== rank && !locked.has(r.rank));
      if (target) {
        target.percentage = Math.max(0, Math.round((target.percentage + diff) * 10) / 10);
      }
    }

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
          const isLocked = locked.has(row.rank);
          return (
            <div key={row.rank} className={`${styles.row} ${isLocked ? styles.rowLocked : ''}`}>
              <span className={styles.rankLabel}>{RANK_LABELS[row.rank]}</span>

              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={row.percentage}
                className={styles.slider}
                disabled={isLocked}
                onChange={(e) => handleChange(row.rank, Number(e.target.value))}
              />

              <div className={styles.percentInputWrap}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={styles.percentInput}
                  value={row.percentage}
                  disabled={isLocked}
                  onChange={(e) => handleChange(row.rank, Number(e.target.value) || 0)}
                />
                <span className={styles.percentSign}>%</span>
              </div>

              <span className={styles.amountValue}>{formatCurrency(amount)}</span>

              <button
                type="button"
                className={`${styles.lockBtn} ${isLocked ? styles.lockBtnActive : ''}`}
                onClick={() => toggleLock(row.rank)}
                title={isLocked ? 'Bỏ khóa' : 'Khóa giá trị này'}
              >
                {isLocked ? <FiLock size={14} /> : <FiUnlock size={14} />}
              </button>
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
          Tổng tỷ lệ phải bằng đúng 100%.
          {totalPercentage > 100
            ? ` Đang vượt ${(totalPercentage - 100).toFixed(1)}%.`
            : ` Còn thiếu ${(100 - totalPercentage).toFixed(1)}%.`}
        </div>
      )}

      <p className={styles.hint}>
        🔒 Khóa hàng nào để giữ nguyên giá trị khi điều chỉnh các hàng khác.
        Các hàng chưa khóa sẽ tự cân bằng để tổng luôn bằng 100%.
      </p>
    </div>
  );
};

export default TabPrizeDistribution;