import { useMemo, useState } from 'react';
import {
  FiCopy,
  FiDownload,
  FiPlusCircle,
  FiRefreshCw,
} from 'react-icons/fi';

import {
  createTicketCodes,
  type CreateTicketCodesResult,
} from '../../services/ticketCodeService';

import styles from './TicketCodeManagement.module.scss';

const toLocalDateTimeValue = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(
    date.getTime() - offset * 60_000
  );

  return local.toISOString().slice(0, 16);
};

const TicketCodeManagement = () => {
  const defaultExpiry = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return toLocalDateTimeValue(date);
  }, []);

  const [quantity, setQuantity] = useState(10);
  const [rewardAmount, setRewardAmount] =
    useState(200);

  const [expiresAt, setExpiresAt] =
    useState(defaultExpiry);

  const [result, setResult] =
    useState<CreateTicketCodesResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const validate = (): string | null => {
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return 'Số lượng mã phải là số nguyên dương.';
    }

    if (quantity > 500) {
      return 'Mỗi lần chỉ nên tạo tối đa 500 mã.';
    }

    if (
      !Number.isFinite(rewardAmount) ||
      rewardAmount <= 0
    ) {
      return 'Giá trị thưởng phải lớn hơn 0.';
    }

    if (!expiresAt) {
      return 'Vui lòng chọn thời gian hết hạn.';
    }

    const expiryDate = new Date(expiresAt);

    if (
      Number.isNaN(expiryDate.getTime()) ||
      expiryDate <= new Date()
    ) {
      return 'Thời gian hết hạn phải nằm trong tương lai.';
    }

    return null;
  };

  const handleCreate = async () => {
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const data = await createTicketCodes({
        quantity,
        rewardAmount,
        expiresAt: new Date(expiresAt).toISOString(),
      });

      setResult(data);
      setMessage(
        `Đã tạo thành công ${data.count} mã ticket.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tạo mã ticket.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setQuantity(10);
    setRewardAmount(200);
    setExpiresAt(defaultExpiry);
    setResult(null);
    setError('');
    setMessage('');
  };

  const handleCopyAll = async () => {
    if (!result?.codes.length) {
      return;
    }

    await navigator.clipboard.writeText(
      result.codes.join('\n')
    );

    setMessage('Đã sao chép toàn bộ mã.');
  };

  const handleCopyOne = async (
    code: string
  ) => {
    await navigator.clipboard.writeText(code);
    setMessage(`Đã sao chép mã ${code}.`);
  };

  const handleExportCsv = () => {
    if (!result?.codes.length) {
      return;
    }

    const rows = [
      ['Code', 'Reward Amount', 'Expires At'],
      ...result.codes.map((code) => [
        code,
        String(result.rewardAmount),
        result.expiresAt,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) =>
            `"${String(cell).replace(/"/g, '""')}"`
          )
          .join(',')
      )
      .join('\n');

    const blob = new Blob(
      ['\uFEFF', csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = `ticket-codes-${Date.now()}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>
            Tạo mã Ticket
          </h1>

          <p className={styles.subtext}>
            Tạo hàng loạt mã thưởng và quản lý kết quả
            ngay sau khi sinh mã.
          </p>
        </div>

        <button
          type="button"
          className={styles.resetBtn}
          onClick={handleReset}
        >
          <FiRefreshCw size={16} />
          Làm mới
        </button>
      </div>

      <div className={styles.layout}>
        <section className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                Thông tin tạo mã
              </h2>

              <p className={styles.cardDesc}>
                Nhập số lượng, giá trị thưởng và hạn sử
                dụng.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>
                Số lượng mã
              </label>

              <input
                type="number"
                min={1}
                max={500}
                className={styles.input}
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    Number(event.target.value)
                  )
                }
              />

              <span className={styles.hint}>
                Khuyến nghị 1–500 mã mỗi lần.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Giá trị thưởng
              </label>

              <input
                type="number"
                min={1}
                className={styles.input}
                value={rewardAmount}
                onChange={(event) =>
                  setRewardAmount(
                    Number(event.target.value)
                  )
                }
              />

              <span className={styles.hint}>
                Giá trị thưởng áp dụng cho từng mã.
              </span>
            </div>

            <div className={styles.fieldFull}>
              <label className={styles.label}>
                Thời gian hết hạn
              </label>

              <input
                type="datetime-local"
                className={styles.input}
                value={expiresAt}
                onChange={(event) =>
                  setExpiresAt(event.target.value)
                }
              />
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              {error}
            </div>
          )}

          {message && (
            <div className={styles.successBox}>
              {message}
            </div>
          )}

          <button
            type="button"
            className={styles.createBtn}
            onClick={handleCreate}
            disabled={loading}
          >
            <FiPlusCircle size={17} />

            {loading
              ? 'Đang tạo mã...'
              : 'Tạo mã Ticket'}
          </button>
        </section>

        <aside className={styles.previewCard}>
          <h2 className={styles.cardTitle}>
            Tóm tắt
          </h2>

          <div className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <span>Số lượng</span>
              <strong>{quantity}</strong>
            </div>

            <div className={styles.summaryRow}>
              <span>Thưởng mỗi mã</span>
              <strong>{rewardAmount}</strong>
            </div>

            <div className={styles.summaryRow}>
              <span>Hết hạn</span>
              <strong>
                {expiresAt
                  ? new Date(
                      expiresAt
                    ).toLocaleString('vi-VN')
                  : '—'}
              </strong>
            </div>
          </div>

          <div className={styles.infoBox}>
            API sẽ tạo toàn bộ mã trong một request và trả
            về danh sách codes.
          </div>
        </aside>
      </div>

      {result && (
        <section className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                Danh sách mã đã tạo
              </h2>

              <p className={styles.cardDesc}>
                {result.count} mã · Thưởng{' '}
                {result.rewardAmount} · Hết hạn{' '}
                {new Date(
                  result.expiresAt
                ).toLocaleString('vi-VN')}
              </p>
            </div>

            <div className={styles.resultActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleCopyAll}
              >
                <FiCopy size={16} />
                Sao chép tất cả
              </button>

              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleExportCsv}
              >
                <FiDownload size={16} />
                Xuất CSV
              </button>
            </div>
          </div>

          <div className={styles.codeGrid}>
            {result.codes.map((code, index) => (
              <div
                key={code}
                className={styles.codeItem}
              >
                <span className={styles.codeIndex}>
                  {index + 1}
                </span>

                <code className={styles.codeText}>
                  {code}
                </code>

                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() =>
                    handleCopyOne(code)
                  }
                  aria-label={`Sao chép ${code}`}
                >
                  <FiCopy size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default TicketCodeManagement;