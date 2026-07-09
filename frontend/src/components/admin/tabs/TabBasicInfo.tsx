import type { TournamentBasicInfo, AllowedBreed, TrackType, RaceCategory } from '../TournamentBuilder';
import styles from './TabBasicInfo.module.scss';

interface Props {
  data: TournamentBasicInfo;
  onChange: (data: TournamentBasicInfo) => void;
  readOnly?: boolean;
}

const TabBasicInfo = ({ data, onChange, readOnly }: Props) => {

const RACE_DISTANCES = [1000, 1200, 1400, 1600, 1800, 2000];

const formatVND = (n: number | '') =>
  n === '' ? '' : Number(n).toLocaleString('vi-VN');

const parseVND = (s: string): number | '' => {
  const cleaned = s.replace(/\./g, '').replace(/,/g, '');
  const n = Number(cleaned);
  return isNaN(n) || cleaned === '' ? '' : n;
};

const TabBasicInfo = ({ data, onChange }: Props) => {
  const update = <K extends keyof TournamentBasicInfo>(field: K, value: TournamentBasicInfo[K]) => {
    onChange({ ...data, [field]: value });
  };

  const isDateRangeInvalid = data.startDate !== '' && data.endDate !== '' && data.endDate < data.startDate;

  return (
    <div className={styles.container}>
      <div className={styles.grid}>

        {/* Name */}
        <div className={`${styles.field} ${styles.fieldFull}`}>
          <label className={styles.label}>Tên giải đấu</label>
          <input
            type="text"
            className={styles.input}
            placeholder="Ví dụ: Royal Stakes – Ascot Cup 2026"
            value={data.name}
            disabled={readOnly}
            onChange={(e) => update('name', e.target.value)}
          />
        </div>

        {/* Dates */}
        <div className={styles.field}>
          <label className={styles.label}>Ngày bắt đầu</label>
          <input
            type="date"
            className={styles.input}
            value={data.startDate}
            disabled={readOnly}
            onChange={(e) => update('startDate', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Ngày kết thúc</label>
          <input
            type="date"
            className={`${styles.input} ${isDateRangeInvalid ? styles.inputError : ''}`}
            value={data.endDate}
            disabled={readOnly}
            onChange={(e) => update('endDate', e.target.value)}
          />
          {isDateRangeInvalid && (
            <span className={styles.errorText}>Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.</span>
          )}
        </div>

        {/* Allowed Breed */}
        <div className={styles.field}>
          <label className={styles.label}>Allowed Breed (bắt buộc)</label>
          <select
            className={styles.input}
            value={data.allowedBreed}
            disabled={readOnly}
            onChange={(e) => update('allowedBreed', e.target.value as AllowedBreed)}
          >
            <option value="">-- Chọn giống ngựa --</option>
            <option value="Thoroughbred">Thoroughbred</option>
            <option value="Arabian">Arabian</option>
            <option value="Quarter Horse">Quarter Horse</option>
            <option value="Mixed">Mixed</option>
          </select>
        </div>

        {/* Track Type */}
        <div className={styles.field}>
          <label className={styles.label}>Track Type</label>
          <select
            className={styles.input}
            value={data.trackType}
            disabled={readOnly}
            onChange={(e) => update('trackType', e.target.value as TrackType)}
          >
            <option value="">-- Chọn loại đường đua --</option>
            <option value="Turf">Turf</option>
            <option value="Dirt">Dirt</option>
            <option value="Synthetic">Synthetic</option>
          </select>
        </div>

        {/* Race Distance với datalist gợi ý */}
        <div className={styles.field}>
          <label className={styles.label}>Race Distance (mét)</label>
          <input
            type="number"
            className={styles.input}
            placeholder="Ví dụ: 1.600"
            list="race-distance-options"
            value={data.raceDistance}
            onChange={(e) => update('raceDistance', e.target.value ? Number(e.target.value) : '')}
            disabled={readOnly}
          />
          <datalist id="race-distance-options">
            {RACE_DISTANCES.map((d) => (
              <option key={d} value={d}>{d.toLocaleString('vi-VN')} m</option>
            ))}
          </datalist>
          <div className={styles.suggestions}>
            {RACE_DISTANCES.map((d) => (
              <button
                key={d}
                type="button"
                className={`${styles.suggestionBtn} ${data.raceDistance === d ? styles.suggestionBtnActive : ''}`}
                onClick={() => update('raceDistance', d)}
                disabled={readOnly}
              >
                {d.toLocaleString('vi-VN')}
              </button>
            ))}
          </div>
        </div>

        {/* Race Category */}
        <div className={styles.field}>
          <label className={styles.label}>Race Category</label>
          <select
            className={styles.input}
            value={data.raceCategory}
            onChange={(e) => update('raceCategory', e.target.value as RaceCategory)}
            disabled={readOnly}
          >
            <option value="">-- Chọn hạng đua --</option>
            <option value="Open">Open</option>
            <option value="Classic">Classic</option>
            <option value="Maiden">Maiden</option>
          </select>
        </div>

        {/* Max Horses */}
        <div className={styles.field}>
          <label className={styles.label}>Max Horses</label>
          <input
            type="number"
            className={styles.input}
            placeholder="Ví dụ: 12"
            value={data.maxHorses}
            onChange={(e) => update('maxHorses', e.target.value ? Number(e.target.value) : '')}
            disabled={readOnly}
          />
        </div>

        {/* Min Jockey Experience */}
        <div className={styles.field}>
          <label className={styles.label}>Min Jockey Experience (năm)</label>
          <input
            type="number"
            className={styles.input}
            placeholder="Ví dụ: 2"
            value={data.minJockeyExperienceYears}
            onChange={(e) => update('minJockeyExperienceYears', e.target.value ? Number(e.target.value) : '')}
            disabled={readOnly}
          />
        </div>

        {/* Purse Amount — format VND */}
        <div className={styles.field}>
          <label className={styles.label}>Purse Amount (quỹ thưởng toàn giải)</label>
          <input
            type="text"
            className={styles.input}
            placeholder="Ví dụ: 500.000.000"
            value={formatVND(data.purseAmount)}
            onChange={(e) => update('purseAmount', parseVND(e.target.value))}
            disabled={readOnly}
          />
        </div>

        {/* Entry Fee Amount — format VND, không tự thêm số 0 */}
        <div className={styles.field}>
          <label className={styles.label}>Entry Fee Amount</label>
          <input
            type="text"
            className={styles.input}
            placeholder="Ví dụ: 500.000"
            value={data.entryFeeAmount === 0 ? '' : formatVND(data.entryFeeAmount)}
            onChange={(e) => {
              const val = parseVND(e.target.value);
              update('entryFeeAmount', val === '' ? 0 : val);
            }}
            disabled={readOnly}
          />
          <span className={styles.hintText}>VND — qua luồng xác nhận phí.</span>
        </div>

        {/* Weight thresholds */}
        <div className={styles.field}>
          <label className={styles.label}>Pre-Race Weight Threshold (kg)</label>
          <input
            type="number"
            step="0.1"
            className={styles.input}
            value={data.preRaceWeightThresholdKg}
            onChange={(e) => update('preRaceWeightThresholdKg', Number(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Post-Race Weight Diff Threshold (kg)</label>
          <input
            type="number"
            step="0.1"
            className={styles.input}
            value={data.postRaceWeightDiffThresholdKg}
            onChange={(e) => update('postRaceWeightDiffThresholdKg', Number(e.target.value) || 0)}
            disabled={readOnly}
          />
        </div>

      </div>
    </div>
  );
};

export default TabBasicInfo;